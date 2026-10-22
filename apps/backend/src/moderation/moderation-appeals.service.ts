import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { ModerationItem } from './moderation-item.entity';
import { ModerationLog } from './moderation-log.entity';
import { ModerationAppeal } from './moderation-appeal.entity';
import { AppealStatus, ModerationAction, ModerationStatus } from './moderation.enums';
import { ModerationService } from './moderation.service';
import { ResolveModerationAppealDto, SubmitModerationAppealDto } from './dto/moderation.dto';

@Injectable()
export class ModerationAppealsService {
  constructor(
    @InjectRepository(ModerationAppeal)
    private readonly appealRepo: Repository<ModerationAppeal>,
    @InjectRepository(ModerationItem)
    private readonly itemRepo: Repository<ModerationItem>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly moderationService: ModerationService,
    private readonly notificationsService: NotificationsService
  ) {}

  async submit(dto: SubmitModerationAppealDto, userId: string): Promise<ModerationAppeal> {
    const item = await this.itemRepo.findOne({ where: { id: dto.moderationItemId } });
    if (!item) throw new NotFoundException('Moderation item not found');
    if (item.status !== ModerationStatus.REJECTED) {
      throw new BadRequestException('Only removed content can be appealed');
    }
    if (item.appealedByUserId) {
      throw new BadRequestException('Appeal already submitted');
    }

    const contentOwnerUserId =
      item.contentOwnerUserId ??
      (await this.moderationService.getContentOwnerUserId(item.contentType, item.contentId));
    if (!contentOwnerUserId) {
      throw new ForbiddenException('Unable to verify content ownership');
    }
    if (contentOwnerUserId !== userId) {
      throw new ForbiddenException('Only the content author can submit an appeal');
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Appeal reason cannot be empty');

    if (!item.contentOwnerUserId) {
      item.contentOwnerUserId = contentOwnerUserId;
      await this.itemRepo.save(item);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const appealRepo = manager.getRepository(ModerationAppeal);
        const itemRepo = manager.getRepository(ModerationItem);
        const logRepo = manager.getRepository(ModerationLog);
        const appeal = await appealRepo.save(
          appealRepo.create({
            moderationItemId: item.id,
            userId,
            reason,
            status: AppealStatus.PENDING,
          })
        );
        await logRepo.save(
          logRepo.create({
            moderationItemId: item.id,
            contentType: item.contentType,
            contentId: item.contentId,
            action: ModerationAction.APPEAL_SUBMITTED,
            performedByUserId: userId,
            note: reason,
          })
        );
        const itemUpdate = await itemRepo.update(
          { id: item.id, status: ModerationStatus.REJECTED, appealedByUserId: null },
          { appealedByUserId: userId, appealReason: reason }
        );
        if (itemUpdate.affected !== 1) {
          throw new BadRequestException('Content is no longer eligible for an appeal');
        }
        return appeal;
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
          .driverError?.constraint === 'UQ_moderation_appeals_moderationItemId'
      ) {
        throw new ConflictException('An appeal has already been submitted for this content');
      }
      throw error;
    }
  }

  getPending() {
    return this.appealRepo.find({
      where: { status: AppealStatus.PENDING },
      relations: { moderationItem: true },
      order: { createdAt: 'ASC' },
    });
  }

  async resolve(
    id: string,
    dto: ResolveModerationAppealDto,
    moderatorId: string
  ): Promise<ModerationAppeal> {
    const resolved = await this.dataSource.transaction(async (manager) => {
      const appealRepo = manager.getRepository(ModerationAppeal);
      const itemRepo = manager.getRepository(ModerationItem);
      const logRepo = manager.getRepository(ModerationLog);
      const appeal = await appealRepo.findOne({
        where: { id },
        relations: { moderationItem: true },
      });
      if (!appeal) throw new NotFoundException('Appeal not found');
      if (appeal.status !== AppealStatus.PENDING) {
        throw new BadRequestException('Appeal has already been resolved');
      }

      const resolvedAt = new Date();
      const result = await appealRepo.update(
        { id, status: AppealStatus.PENDING },
        {
          status: dto.status,
          resolvedByUserId: moderatorId,
          resolutionNote: dto.resolutionNote?.trim() ?? null,
          resolvedAt,
        }
      );
      if (result.affected !== 1) {
        throw new BadRequestException('Appeal has already been resolved');
      }

      const itemResult = await itemRepo.update(
        {
          id: appeal.moderationItemId,
          status: In([ModerationStatus.REJECTED, ModerationStatus.APPEALED]),
        },
        {
          status:
            dto.status === AppealStatus.ACCEPTED
              ? ModerationStatus.APPROVED
              : ModerationStatus.REJECTED,
          ...(dto.status === AppealStatus.ACCEPTED ? { isHidden: false } : {}),
          reviewedByUserId: moderatorId,
          reviewNote: dto.resolutionNote?.trim() ?? null,
          appealedByUserId: appeal.userId,
          appealReason: appeal.reason,
        }
      );
      if (itemResult.affected !== 1) {
        throw new BadRequestException('Moderated content is no longer eligible for resolution');
      }

      await logRepo.save(
        logRepo.create({
          moderationItemId: appeal.moderationItemId,
          contentType: appeal.moderationItem.contentType,
          contentId: appeal.moderationItem.contentId,
          action:
            dto.status === AppealStatus.ACCEPTED
              ? ModerationAction.APPEAL_APPROVED
              : ModerationAction.APPEAL_REJECTED,
          performedByUserId: moderatorId,
          note: dto.resolutionNote?.trim() ?? null,
        })
      );

      return {
        ...appeal,
        status: dto.status,
        resolvedByUserId: moderatorId,
        resolutionNote: dto.resolutionNote?.trim() ?? null,
        resolvedAt,
      };
    });

    const outcome = dto.status === AppealStatus.ACCEPTED ? 'accepted' : 'rejected';
    await this.notificationsService.create(
      resolved.userId,
      NotificationType.MODERATION_APPEAL,
      `Your appeal for removed ${resolved.moderationItem.contentType} content was ${outcome}.`
    );

    return resolved;
  }
}