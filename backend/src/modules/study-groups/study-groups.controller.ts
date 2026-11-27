import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudyGroupsService } from './study-groups.service';
import { CreateStudyGroupDto } from './dto/create-study-group.dto';
import { CreateGroupMessageDto } from './dto/create-group-message.dto';

@Controller('v1/study-groups')
@UseGuards(JwtAuthGuard)
export class StudyGroupsController {
  constructor(private readonly studyGroupsService: StudyGroupsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateStudyGroupDto) {
    return this.studyGroupsService.create(req.user.id, dto);
  }

  @Post(':id/join')
  async join(@Req() req: any, @Param('id') id: string) {
    return this.studyGroupsService.join(id, req.user.id);
  }

  @Get(':id/messages')
  async getMessages(@Req() req: any, @Param('id') id: string) {
    await this.assertMember(id, req.user.id);
    return this.studyGroupsService.getMessages(id);
  }

  @Post(':id/messages')
  async postMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateGroupMessageDto,
  ) {
    await this.assertMember(id, req.user.id);
    return this.studyGroupsService.addMessage(id, req.user.id, dto);
  }

  @Get(':id/progress')
  async getProgress(@Req() req: any, @Param('id') id: string) {
    await this.assertMember(id, req.user.id);
    return this.studyGroupsService.getProgress(id);
  }

  private async assertMember(groupId: string, userId: string): Promise<void> {
    const group = await this.studyGroupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException('Study group not found');
    }
    const isMember = await this.studyGroupsService.isMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this study group');
    }
  }
}
