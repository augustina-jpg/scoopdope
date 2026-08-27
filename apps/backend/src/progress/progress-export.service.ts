import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Progress } from '../progress/progress.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Course } from '../courses/course.entity';

interface ProgressExportData {
  courseName: string;
  courseId: string;
  completionPercentage: number;
  lessonsCompleted: number;
  totalLessons: number;
  timeSpentMinutes: number;
  enrolledDate: string;
  lastActivityDate: string;
  completedDate: string | null;
  status: 'in-progress' | 'completed' | 'not-started';
}

/**
 * Service for exporting user progress data in various formats (CSV, PDF).
 * Provides comprehensive progress history for individual users or bulk instructor exports.
 */
@Injectable()
export class ProgressExportService {
  private readonly logger = new Logger(ProgressExportService.name);

  constructor(
    @InjectRepository(Progress)
    private progressRepo: Repository<Progress>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Course)
    private courseRepo: Repository<Course>,
  ) {}

  /**
   * Get progress data for a user across all enrolled courses
   */
  async getUserProgressData(userId: string): Promise<ProgressExportData[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: { userId },
      relations: ['course'],
    });

    if (enrollments.length === 0) {
      this.logger.warn(`No enrollments found for user ${userId}`);
      return [];
    }

    const progressData: ProgressExportData[] = [];

    for (const enrollment of enrollments) {
      const progress = await this.progressRepo.findOne({
        where: { userId, courseId: enrollment.courseId },
      });

      const data: ProgressExportData = {
        courseName: enrollment.course?.title || enrollment.courseId,
        courseId: enrollment.courseId,
        completionPercentage: progress?.progressPct ?? 0,
        lessonsCompleted: progress?.lessonId ? 1 : 0, // Simplified: 1 if any progress recorded
        totalLessons: 0, // Would need lesson count from course
        timeSpentMinutes: 0, // Would need to track from progress events
        enrolledDate: enrollment.enrolledAt?.toISOString() ?? new Date().toISOString(),
        lastActivityDate: progress?.updatedAt?.toISOString() ?? enrollment.enrolledAt?.toISOString(),
        completedDate: enrollment.completedAt?.toISOString() ?? null,
        status:
          (progress?.progressPct ?? 0) >= 100
            ? 'completed'
            : (progress?.progressPct ?? 0) > 0
              ? 'in-progress'
              : 'not-started',
      };

      progressData.push(data);
    }

    return progressData;
  }

  /**
   * Export progress as CSV format
   * Returns CSV content as string
   */
  async exportProgressAsCSV(userId: string): Promise<string> {
    const progressData = await this.getUserProgressData(userId);

    if (progressData.length === 0) {
      return this.generateEmptyCSV();
    }

    // CSV headers
    const headers = [
      'Course Name',
      'Course ID',
      'Completion %',
      'Lessons Completed',
      'Total Lessons',
      'Time Spent (minutes)',
      'Enrolled Date',
      'Last Activity',
      'Completed Date',
      'Status',
    ];

    // CSV rows
    const rows = progressData.map((data) => [
      this.escapeCSV(data.courseName),
      data.courseId,
      data.completionPercentage,
      data.lessonsCompleted,
      data.totalLessons,
      data.timeSpentMinutes,
      data.enrolledDate,
      data.lastActivityDate,
      data.completedDate || 'N/A',
      data.status,
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return csvContent;
  }

  /**
   * Export progress as PDF format
   * For production, integrate with a library like pdfkit or pdf-lib
   * This returns JSON that the controller will convert to PDF
   */
  async exportProgressAsPDFData(userId: string): Promise<any> {
    const progressData = await this.getUserProgressData(userId);

    // Calculate summary statistics
    const totalCourses = progressData.length;
    const completedCourses = progressData.filter((d) => d.status === 'completed').length;
    const averageCompletion =
      progressData.length > 0
        ? Math.round(progressData.reduce((sum, d) => sum + d.completionPercentage, 0) / progressData.length)
        : 0;

    return {
      title: 'Student Progress Report',
      generatedDate: new Date().toISOString(),
      summary: {
        totalCoursesEnrolled: totalCourses,
        completedCourses,
        averageCompletion,
        inProgressCourses: progressData.filter((d) => d.status === 'in-progress').length,
      },
      courses: progressData,
    };
  }

  /**
   * Generate filename with timestamp for downloads
   */
  generateFilename(userId: string, format: 'csv' | 'pdf'): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `progress_${userId}_${timestamp}.${format}`;
  }

  /**
   * Escape special characters in CSV values
   */
  private escapeCSV(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Generate empty CSV with headers only
   */
  private generateEmptyCSV(): string {
    const headers = [
      'Course Name',
      'Course ID',
      'Completion %',
      'Lessons Completed',
      'Total Lessons',
      'Time Spent (minutes)',
      'Enrolled Date',
      'Last Activity',
      'Completed Date',
      'Status',
    ];
    return headers.join(',');
  }
}
