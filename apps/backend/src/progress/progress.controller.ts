import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { ProgressExportService } from './progress-export.service';
import { RecordProgressDto } from './dto/record-progress.dto';
import { ProgressExportQueryDto } from './dto/progress-export.dto';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProgressController {
  constructor(
    private progressService: ProgressService,
    private progressExportService: ProgressExportService
  ) {}

  @Post('progress')
  @ApiOperation({ summary: 'Record lesson completion and update on-chain progress' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiBody({ schema: { example: { courseId: 'uuid', lessonId: 'uuid', progressPct: 75 } } })
  @ApiResponse({
    status: 201,
    description: 'Progress recorded',
    schema: { example: { id: 'uuid', courseId: 'uuid', progressPct: 75 } },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  record(@Request() req: any, @Body() dto: RecordProgressDto) {
    return this.progressService.record(req.user.id, dto, req.user.stellarPublicKey);
  }

  @Get('users/:id/progress')
  @ApiOperation({ summary: 'Get all progress records for a user' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 200,
    description: 'List of progress records',
    schema: {
      example: [{ courseId: 'uuid', progressPct: 75, updatedAt: '2024-01-01T00:00:00.000Z' }],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUser(@Param('id') id: string) {
    return this.progressService.findByUser(id);
  }

  /**
   * Export user progress data as CSV or PDF
   * Query params:
   * - format: 'csv' or 'pdf' (default: 'csv')
   * - userId: optional user ID for instructors to export specific student progress
   */
  @Get('users/:id/progress/export')
  @ApiOperation({
    summary: 'Export user progress as CSV or PDF',
    description:
      'Downloads progress data in the specified format. Users can export their own data; ' +
      'instructors can export their students\' progress.',
  })
  @ApiResponse({
    status: 200,
    description: 'Export successful',
    schema: {
      example: {
        success: true,
        message: 'Export completed',
        filename: 'progress_userId_2024-01-15.csv',
        format: 'csv',
        data: 'Course Name,Completion %,...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid format parameter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot export other user\'s data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async exportProgress(
    @Param('id') userId: string,
    @Query('format') format: string = 'csv',
    @Request() req: { user: { id: string; role: string } }
  ) {
    // Validate format parameter
    if (!['csv', 'pdf'].includes(format)) {
      throw new BadRequestException('Format must be "csv" or "pdf"');
    }

    // Authorization: users can only export their own data unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      throw new BadRequestException('You can only export your own progress data');
    }

    try {
      let data: string;
      const formatType = format as 'csv' | 'pdf';

      if (formatType === 'csv') {
        data = await this.progressExportService.exportProgressAsCSV(userId);
      } else {
        // For PDF, we return JSON that the frontend can use to generate PDF
        // Alternatively, use a library like pdfkit on the backend
        const pdfData = await this.progressExportService.exportProgressAsPDFData(userId);
        data = JSON.stringify(pdfData);
      }

      const filename = this.progressExportService.generateFilename(userId, formatType);

      return {
        success: true,
        message: `Progress exported as ${formatType.toUpperCase()}`,
        filename,
        format: formatType,
        data,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to export progress: ${error.message}`);
    }
  }
}
