import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ModerationItem } from './moderation-item.entity';
import { AppealStatus } from './moderation.enums';

@Entity('moderation_appeals')
@Unique('UQ_moderation_appeals_moderationItemId', ['moderationItemId'])
@Index('IDX_moderation_appeals_status_createdAt', ['status', 'createdAt'])
export class ModerationAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moderationItemId: string;

  @ManyToOne(() => ModerationItem, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'moderationItemId' })
  moderationItem: ModerationItem;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: AppealStatus,
    enumName: 'moderation_appeals_status_enum',
    default: AppealStatus.PENDING,
  })
  status: AppealStatus;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}