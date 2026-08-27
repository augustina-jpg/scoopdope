import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Patch,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessibilityService } from './accessibility.service';

@ApiTags('accessibility')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AccessibilityController {
  constructor(private readonly accessibilityService: AccessibilityService) {}

  /**
   * Run accessibility validation on a course.
   * Scans all lessons and generates a report with issues found.
   */
  @Post('courses/:id/accessibility/validate')
  @ApiOperation({
    summary: 'Validate course for accessibility compliance',
    description:
      'Scans the course content for accessibility issues including missing alt text, ' +
      'captions, font sizes, contrast ratios, heading structure, and link descriptions.',
  })
  @ApiResponse({ status: 200, description: 'Accessibility report generated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - must be course instructor or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async validateCourse(
    @Param('id') courseId: string,
    @Request() req: { user: { id: string; role: string } },
    @Body() body?: { courseContent?: any }
  ) {
    // In production, fetch course content from DB based on courseId
    // For now, accept it in the body or fetch from courses service
    const courseContent = body?.courseContent || { lessons: [] };

    try {
      const report = await this.accessibilityService.validateCourse(courseId, courseContent);
      return {
        success: true,
        report,
        message: `Validation complete: ${report.activeIssuesCount} active issues found`,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to validate course: ${error.message}`);
    }
  }

  /**
   * Get the accessibility report for a course
   */
  @Get('courses/:id/accessibility/report')
  @ApiOperation({
    summary: 'Get accessibility report for a course',
    description:
      'Retrieves the latest accessibility report showing all issues, ' +
      'compliance score, and remediation suggestions.',
  })
  @ApiResponse({ status: 200, description: 'Accessibility report' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getReport(@Param('id') courseId: string) {
    const report = await this.accessibilityService.getReport(courseId);
    return {
      success: true,
      report,
      stats: {
        totalIssues: report.totalIssuesFound,
        activeIssues: report.activeIssuesCount,
        errors: report.errorCount,
        warnings: report.warningCount,
        compliancePercentage: report.compliancePercentage,
        lastValidated: report.lastValidatedAt,
      },
    };
  }

  /**
   * Get unresolved accessibility issues for a course
   */
  @Get('courses/:id/accessibility/issues')
  @ApiOperation({
    summary: 'Get unresolved accessibility issues',
    description: 'Returns all active (unresolved) accessibility issues for a course, sorted by severity.',
  })
  @ApiResponse({ status: 200, description: 'List of unresolved issues' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getUnresolvedIssues(@Param('id') courseId: string) {
    const issues = await this.accessibilityService.getUnresolvedIssues(courseId);
    return {
      success: true,
      issues,
      count: issues.length,
    };
  }

  /**
   * Mark an accessibility issue as resolved
   */
  @Patch('accessibility/issues/:issueId/resolve')
  @ApiOperation({
    summary: 'Mark accessibility issue as resolved',
    description: 'Records that an accessibility issue has been fixed and is no longer active.',
  })
  @ApiResponse({ status: 200, description: 'Issue marked as resolved' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async resolveIssue(@Param('issueId') issueId: string) {
    const issue = await this.accessibilityService.resolveIssue(issueId);
    return {
      success: true,
      issue,
      message: `Issue resolved at ${issue.resolvedAt}`,
    };
  }

  /**
   * Mark an accessibility issue as unresolved (reopen it)
   */
  @Patch('accessibility/issues/:issueId/unresolve')
  @ApiOperation({
    summary: 'Mark accessibility issue as unresolved',
    description: 'Reopens a previously resolved accessibility issue.',
  })
  @ApiResponse({ status: 200, description: 'Issue marked as unresolved' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async unresolveIssue(@Param('issueId') issueId: string) {
    const issue = await this.accessibilityService.unresolveIssue(issueId);
    return {
      success: true,
      issue,
      message: 'Issue reopened',
    };
  }
}
