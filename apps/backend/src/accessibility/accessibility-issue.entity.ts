import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Course } from '../courses/course.entity';

export enum AccessibilityIssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AccessibilityIssueType {
  MISSING_ALT_TEXT = 'missing_alt_text',
  LOW_COLOR_CONTRAST = 'low_color_contrast',
  MISSING_CAPTIONS = 'missing_captions',
  SMALL_FONT_SIZE = 'small_font_size',
  MISSING_HEADING = 'missing_heading',
  EMPTY_LINK = 'empty_link',
  FORM_LABEL_MISSING = 'form_label_missing',
}

@Entity('accessibility_issues')
export class AccessibilityIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  courseId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  lessonId: string;

  @Column({ nullable: true })
  elementId: string | null;

  @Column({ nullable: true })
  elementSelector: string | null;

  @Column({ type: 'enum', enum: AccessibilityIssueType })
  type: AccessibilityIssueType;

  @Column({ type: 'enum', enum: AccessibilityIssueSeverity, default: AccessibilityIssueSeverity.WARNING })
  severity: AccessibilityIssueSeverity;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  suggestedFix: string | null;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  updatedAt: Date | null;
}
