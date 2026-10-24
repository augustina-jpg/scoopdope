import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { NotificationType } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.entity';
import { ModerationAppeal } from './moderation-appeal.entity';
import { ModerationItem } from './moderation-item.entity';
import { ModerationLog } from './moderation-log.entity';
import { ModerationAppealsService } from './moderation-appeals.service';
import { ModerationService } from './moderation.service';
import {
  AppealStatus,
  ContentType,
  ModerationAction,
  ModerationStatus,
} from './moderation.enums';
import { setupTestDatabase, teardownTestDatabase } from '../test/integration-test.setup';

describe('ModerationAppealsService (Integration)', () => {
  let dataSource: DataSource;
  let service: ModerationAppealsService;
  let users: Repository<User>;
  let items: Repository<ModerationItem>;
  let appeals: Repository<ModerationAppeal>;
  let logs: Repository<ModerationLog>;
  const moderationService = {
    getContentOwnerUserId: jest.fn(),
  };
  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    users = dataSource.getRepository(User);
    items = dataSource.getRepository(ModerationItem);
    appeals = dataSource.getRepository(ModerationAppeal);
    logs = dataSource.getRepository(ModerationLog);
    service = new ModerationAppealsService(
      appeals,
      items,
      dataSource,
      moderationService as unknown as ModerationService,
      notificationsService as unknown as NotificationsService
    );
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await appeals.clear();
    await logs.clear();
    await items.clear();
    await users.clear();
  });

  async function createUser(email: string): Promise<User> {
    return users.save(users.create({ email, passwordHash: 'test-hash', role: 'student' }));
  }

  async function createRejectedItem(ownerId: string): Promise<ModerationItem> {
    return items.save(
      items.create({
        contentType: ContentType.POST,
        contentId: 'removed-post-id',
        reportedByUserId: ownerId,
        contentOwnerUserId: ownerId,
        status: ModerationStatus.REJECTED,
        isHidden: true,
      })
    );
  }

  it('submits, queues, accepts, notifies, and prevents reopening an appeal', async () => {
    const author = await createUser('appeal-author@example.com');
    const moderator = await createUser('appeal-moderator@example.com');
    const item = await createRejectedItem(author.id);

    const submitted = await service.submit(
      { moderationItemId: item.id, reason: 'This post was removed in error.' },
      author.id
    );

    expect(submitted.status).toBe(AppealStatus.PENDING);
    expect((await items.findOneByOrFail({ id: item.id })).appealedByUserId).toBe(author.id);
    expect((await service.getPending()).map((appeal) => appeal.id)).toEqual([submitted.id]);

    const resolved = await service.resolve(
      submitted.id,
      { status: AppealStatus.ACCEPTED, resolutionNote: 'Restored after review.' },
      moderator.id
    );

    expect(resolved.status).toBe(AppealStatus.ACCEPTED);
    expect(await service.getPending()).toEqual([]);
    expect(await items.findOneByOrFail({ id: item.id })).toMatchObject({
      status: ModerationStatus.APPROVED,
      isHidden: false,
    });
    expect(await logs.findOneBy({ moderationItemId: item.id })).toMatchObject({
      action: ModerationAction.APPEAL_APPROVED,
      performedByUserId: moderator.id,
    });
    expect(notificationsService.create).toHaveBeenCalledWith(
      author.id,
      NotificationType.MODERATION_APPEAL,
      expect.stringContaining('accepted')
    );
    await expect(
      service.resolve(submitted.id, { status: AppealStatus.REJECTED }, moderator.id)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submit(
        { moderationItemId: item.id, reason: 'I want to reopen this appeal.' },
        author.id
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects submissions from users who do not own the removed content', async () => {
    const author = await createUser('appeal-owner@example.com');
    const otherUser = await createUser('appeal-other@example.com');
    const item = await createRejectedItem(author.id);

    await expect(
      service.submit(
        { moderationItemId: item.id, reason: 'I disagree with this removal.' },
        otherUser.id
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await appeals.count()).toBe(0);
  });

  it('rejects the appeal and notifies its author', async () => {
    const author = await createUser('appeal-rejected@example.com');
    const moderator = await createUser('appeal-reviewer@example.com');
    const item = await createRejectedItem(author.id);
    const submitted = await service.submit(
      { moderationItemId: item.id, reason: 'Please reconsider this removal.' },
      author.id
    );

    const resolved = await service.resolve(
      submitted.id,
      { status: AppealStatus.REJECTED },
      moderator.id
    );

    expect(resolved.status).toBe(AppealStatus.REJECTED);
    expect((await items.findOneByOrFail({ id: item.id })).status).toBe(ModerationStatus.REJECTED);
    expect(notificationsService.create).toHaveBeenCalledWith(
      author.id,
      NotificationType.MODERATION_APPEAL,
      expect.stringContaining('rejected')
    );
  });

  it('persists owner lookup for older moderation items and rejects duplicate appeals', async () => {
    const author = await createUser('appeal-legacy@example.com');
    const item = await items.save(
      items.create({
        contentType: ContentType.POST,
        contentId: 'legacy-post-id',
        reportedByUserId: 'reporter-id',
        contentOwnerUserId: null,
        status: ModerationStatus.REJECTED,
        isHidden: true,
      })
    );
    moderationService.getContentOwnerUserId.mockResolvedValue(author.id);

    const submitted = await service.submit(
      { moderationItemId: item.id, reason: 'The stored owner needs a backfill.' },
      author.id
    );

    expect((await items.findOneByOrFail({ id: item.id })).contentOwnerUserId).toBe(author.id);
    await expect(
      service.submit(
        { moderationItemId: item.id, reason: 'A second appeal is not allowed.' },
        author.id
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await appeals.count()).toBe(1);
    expect(submitted.status).toBe(AppealStatus.PENDING);
  });
});