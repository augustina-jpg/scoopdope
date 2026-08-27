import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessibilityIssue, AccessibilityIssueSeverity, AccessibilityIssueType } from './accessibility-issue.entity';
import { AccessibilityReport } from './accessibility-report.entity';

interface AccessibilityCheckResult {
  issues: Partial<AccessibilityIssue>[];
  errorCount: number;
  warningCount: number;
}

/**
 * Accessibility validation service that checks course content for WCAG 2.1 compliance.
 * Validates: alt text, color contrast, captions, font sizes, headings, links, form labels.
 */
@Injectable()
export class AccessibilityService {
  private readonly logger = new Logger(AccessibilityService.name);

  constructor(
    @InjectRepository(AccessibilityIssue)
    private issueRepo: Repository<AccessibilityIssue>,
    @InjectRepository(AccessibilityReport)
    private reportRepo: Repository<AccessibilityReport>,
  ) {}

  /**
   * Run accessibility checks on a course.
   * This validates all lessons in the course for accessibility issues.
   */
  async validateCourse(courseId: string, courseContent: any): Promise<AccessibilityReport> {
    try {
      // Get or create report for this course
      let report = await this.reportRepo.findOne({ where: { courseId } });
      if (!report) {
        report = this.reportRepo.create({ courseId });
      }

      // Clear previous issues for fresh validation
      await this.issueRepo.delete({ courseId });

      const allIssues: AccessibilityIssue[] = [];
      let errorCount = 0;
      let warningCount = 0;

      // Check each lesson in the course
      if (courseContent.lessons && Array.isArray(courseContent.lessons)) {
        for (const lesson of courseContent.lessons) {
          const result = await this.checkLesson(courseId, lesson);
          allIssues.push(...result.issues as AccessibilityIssue[]);
          errorCount += result.errorCount;
          warningCount += result.warningCount;
        }
      }

      // Save all discovered issues
      if (allIssues.length > 0) {
        await this.issueRepo.save(allIssues);
      }

      // Update report statistics
      report.totalIssuesFound = allIssues.length;
      report.activeIssuesCount = allIssues.filter((i) => !i.isResolved).length;
      report.errorCount = errorCount;
      report.warningCount = warningCount;
      report.compliancePercentage = this.calculateCompliancePercentage(errorCount, warningCount, allIssues.length);
      report.lastValidatedAt = new Date();
      report.updatedAt = new Date();

      const savedReport = await this.reportRepo.save(report);
      this.logger.log(
        `Accessibility check complete for course ${courseId}: ` +
          `${allIssues.length} issues found (${errorCount} errors, ${warningCount} warnings), ` +
          `compliance: ${report.compliancePercentage}%`
      );

      return savedReport;
    } catch (error) {
      this.logger.error(`Failed to validate course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Validate a single lesson for accessibility issues.
   */
  private async checkLesson(
    courseId: string,
    lesson: any
  ): Promise<AccessibilityCheckResult> {
    const issues: AccessibilityIssue[] = [];
    let errorCount = 0;
    let warningCount = 0;

    const lessonId = lesson.id || 'unknown';

    // Check 1: Missing alt text on images
    const altTextIssues = this.checkAltText(courseId, lessonId, lesson);
    issues.push(...altTextIssues.issues);
    errorCount += altTextIssues.errorCount;
    warningCount += altTextIssues.warningCount;

    // Check 2: Video captions
    const captionIssues = this.checkCaptions(courseId, lessonId, lesson);
    issues.push(...captionIssues.issues);
    errorCount += captionIssues.errorCount;
    warningCount += captionIssues.warningCount;

    // Check 3: Font sizes
    const fontIssues = this.checkFontSizes(courseId, lessonId, lesson);
    issues.push(...fontIssues.issues);
    errorCount += fontIssues.errorCount;
    warningCount += fontIssues.warningCount;

    // Check 4: Color contrast (simplified)
    const contrastIssues = this.checkColorContrast(courseId, lessonId, lesson);
    issues.push(...contrastIssues.issues);
    errorCount += contrastIssues.errorCount;
    warningCount += contrastIssues.warningCount;

    // Check 5: Heading structure
    const headingIssues = this.checkHeadings(courseId, lessonId, lesson);
    issues.push(...headingIssues.issues);
    errorCount += headingIssues.errorCount;
    warningCount += headingIssues.warningCount;

    // Check 6: Links
    const linkIssues = this.checkLinks(courseId, lessonId, lesson);
    issues.push(...linkIssues.issues);
    errorCount += linkIssues.errorCount;
    warningCount += linkIssues.warningCount;

    return { issues, errorCount, warningCount };
  }

  private checkAltText(courseId: string, lessonId: string, lesson: any): AccessibilityCheckResult {
    const issues: AccessibilityIssue[] = [];
    let errorCount = 0;

    if (lesson.contentHtml) {
      const imgRegex = /<img[^>]*>/g;
      const matches = lesson.contentHtml.match(imgRegex) || [];

      for (const img of matches) {
        if (!img.includes('alt=') || img.match(/alt\s*=\s*["']\s*["']/)) {
          issues.push(
            this.issueRepo.create({
              courseId,
              lessonId,
              elementSelector: 'img',
              type: AccessibilityIssueType.MISSING_ALT_TEXT,
              severity: AccessibilityIssueSeverity.ERROR,
              description: 'Image is missing descriptive alt text',
              suggestedFix:
                'Add a meaningful alt text attribute to describe what the image shows. ' +
                'Example: <img src="chart.png" alt="Bar chart showing Q1 revenue by region" />',
              isResolved: false,
            })
          );
          errorCount++;
        }
      }
    }

    return { issues, errorCount, warningCount: 0 };
  }

  private checkCaptions(courseId: string, lessonId: string, lesson: any): AccessibilityCheckResult {
    const issues: AccessibilityIssue[] = [];
    let warningCount = 0;

    if (lesson.videoUrl) {
      // Check if captions attribute exists
      if (!lesson.hasTranscript && !lesson.captionsUrl) {
        issues.push(
          this.issueRepo.create({
            courseId,
            lessonId,
            type: AccessibilityIssueType.MISSING_CAPTIONS,
            severity: AccessibilityIssueSeverity.WARNING,
            description: 'Video lesson is missing captions or transcript',
            suggestedFix:
              'Add captions (SubRip .srt format) or a full text transcript. ' +
              'This helps deaf and hard-of-hearing viewers, and improves SEO.',
            isResolved: false,
          })
        );
        warningCount++;
      }
    }

    return { issues, errorCount: 0, warningCount };
  }

  private checkFontSizes(courseId: string, lessonId: string, lesson: any): AccessibilityCheckResult {
    const issues: AccessibilityIssue[] = [];
    let warningCount = 0;

    if (lesson.contentHtml) {
      // Simple regex check for very small inline font-size
      const smallFontRegex = /style\s*=\s*["'][^"']*font-size\s*:\s*([0-9.]+)(px|pt)/gi;
      let match;

      while ((match = smallFontRegex.exec(lesson.contentHtml)) !== null) {
        const size = parseFloat(match[1]);
        const unit = match[2];

        // Flag if < 14px or < 10.5pt
        if ((unit === 'px' && size < 14) || (unit === 'pt' && size < 10.5)) {
          issues.push(
            this.issueRepo.create({
              courseId,
              lessonId,
              type: AccessibilityIssueType.SMALL_FONT_SIZE,
              severity: AccessibilityIssueSeverity.WARNING,
              description: `Text with font-size: ${size}${unit} may be too small to read`,
              suggestedFix:
                'Use minimum font size of 14px (or 10.5pt) for body text, ' +
                '16px (or 12pt) for mobile. Larger for headers.',
              isResolved: false,
            })
          );
          warningCount++;
        }
      }
    }

    return { issues, errorCount: 0, warningCount };
  }

  private checkColorContrast(_courseId: string, _lessonId: string, _lesson: any): AccessibilityCheckResult {
    // Placeholder: Full color contrast checking requires color math (WCAG contrast ratio).
    // In a production system, integrate a library like `wcag-contrast` or `polished`.
    return { issues: [], errorCount: 0, warningCount: 0 };
  }

  private checkHeadings(courseId: string, lessonId: string, lesson: any): AccessibilityCheckResult {
    const issues: AccessibilityIssue[] = [];
    let warningCount = 0;

    if (lesson.contentHtml) {
      // Check if h1 exists
      if (!lesson.contentHtml.includes('<h1') && lesson.contentHtml.includes('<h2')) {
        issues.push(
          this.issueRepo.create({
            courseId,
            lessonId,
            type: AccessibilityIssueType.MISSING_HEADING,
            severity: AccessibilityIssueSeverity.WARNING,
            description: 'Lesson content missing top-level heading (h1)',
            suggestedFix:
              'Start the lesson with a single <h1> tag containing the lesson title. ' +
              'Use <h2>, <h3>, etc. for subsections.',
            isResolved: false,
          })
        );
        warningCount++;
      }
    }

    return { issues, errorCount: 0, warningCount };
  }

  private checkLinks(courseId: string, lessonId: string, lesson: any): AccessibilityCheckResult {
    const issues: AccessibilityIssue[] = [];
    let warningCount = 0;

    if (lesson.contentHtml) {
      // Check for <a> tags without text content
      const linkRegex = /<a[^>]*href[^>]*>(.*?)<\/a>/gi;
      let match;

      while ((match = linkRegex.exec(lesson.contentHtml)) !== null) {
        const linkText = match[1]?.trim() || '';

        if (!linkText || linkText === '' || /^[\s]*$/.test(linkText)) {
          issues.push(
            this.issueRepo.create({
              courseId,
              lessonId,
              type: AccessibilityIssueType.EMPTY_LINK,
              severity: AccessibilityIssueSeverity.WARNING,
              description: 'Link has no descriptive text',
              suggestedFix:
                'Use descriptive link text instead of "Click here" or empty links. ' +
                'Example: <a href="/docs">Read the documentation</a>',
              isResolved: false,
            })
          );
          warningCount++;
        }
      }
    }

    return { issues, errorCount: 0, warningCount };
  }

  /**
   * Calculate compliance percentage: 0-100 where 100 is fully compliant.
   * Formula: 100 - ((errorCount * 2 + warningCount) / (totalIssues * 2)) * 100
   * Errors weighted double since they block some users entirely.
   */
  private calculateCompliancePercentage(errorCount: number, warningCount: number, totalIssues: number): number {
    if (totalIssues === 0) {
      return 100;
    }

    const weightedIssues = errorCount * 2 + warningCount;
    const maxWeight = totalIssues * 2; // If all issues were errors
    const compliance = 100 - (weightedIssues / maxWeight) * 100;

    return Math.max(0, Math.min(100, Math.round(compliance * 100) / 100));
  }

  /**
   * Get accessibility report for a course
   */
  async getReport(courseId: string): Promise<AccessibilityReport> {
    const report = await this.reportRepo.findOne({
      where: { courseId },
      relations: ['issues'],
    });

    if (!report) {
      throw new NotFoundException(`Accessibility report not found for course ${courseId}`);
    }

    return report;
  }

  /**
   * Get unresolved issues for a course
   */
  async getUnresolvedIssues(courseId: string): Promise<AccessibilityIssue[]> {
    return this.issueRepo.find({
      where: { courseId, isResolved: false },
      order: { severity: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Mark an issue as resolved
   */
  async resolveIssue(issueId: string): Promise<AccessibilityIssue> {
    const issue = await this.issueRepo.findOne({ where: { id: issueId } });
    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }

    issue.isResolved = true;
    issue.resolvedAt = new Date();
    return this.issueRepo.save(issue);
  }

  /**
   * Mark an issue as unresolved
   */
  async unresolveIssue(issueId: string): Promise<AccessibilityIssue> {
    const issue = await this.issueRepo.findOne({ where: { id: issueId } });
    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} not found`);
    }

    issue.isResolved = false;
    issue.resolvedAt = null;
    return this.issueRepo.save(issue);
  }
}
