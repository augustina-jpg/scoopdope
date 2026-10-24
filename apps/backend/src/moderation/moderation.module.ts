import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationItem } from './moderation-item.entity';
import { ModerationLog } from './moderation-log.entity';
import { ModerationAppeal } from './moderation-appeal.entity';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ModerationAppealsController } from './moderation-appeals.controller';
import { ModerationAppealsService } from './moderation-appeals.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { Course } from '../courses/course.entity';
import { Review } from '../courses/review.entity';
import { Post } from '../forums/post.entity';
import { Reply } from '../forums/reply.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModerationItem,
      ModerationLog,
      ModerationAppeal,
      Course,
      Post,
      Reply,
      Review,
    ]),
    NotificationsModule,
  ],
  providers: [ModerationService, ModerationAppealsService],
  controllers: [ModerationController, ModerationAppealsController],
  exports: [ModerationService],
})
export class ModerationModule {}
