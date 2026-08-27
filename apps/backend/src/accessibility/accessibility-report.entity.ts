import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Course } from '../courses/course.entity';
import { AccessibilityIssue } from './accessibility-issue.entity';

@Entity('accessibility_reports')
export class AccessibilityReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  courseId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @OneToMany(() => AccessibilityIssue, (issue) => issue.course)
  issues: AccessibilityIssue[];

  /**
   * Total number of issues found (including resolved ones for historical tracking)
   */
  @Column({ type: 'int', default: 0 })
  totalIssuesFound: number;

  /**
   * Number of currently active (unresolved) issues
   */
  @Column({ type: 'int', default: 0 })
  activeIssuesCount: number;

  /**
   * Number of error-level issues (most critical)
   */
  @Column({ type: 'int', default: 0 })
  errorCount: number;

  /**
   * Number of warning-level issues
   */
  @Column({ type: 'int', default: 0 })
  warningCount: number;

  /**
   * Compliance percentage: 100 - ((errorCount * 2 + warningCount) / (totalIssuesFound * 2)) * 100
   * Ranges from 0-100. Errors weighted double.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  compliancePercentage: number;

  /**
   * ISO 8601 timestamp of last validation check
   */
  @Column({ nullable: true, type: 'timestamp' })
  lastValidatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  updatedAt: Date | null;
}
