import { Controller, Get, Delete, UseGuards, Request } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('GDPR')
@ApiBearerAuth()
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('export')
  @ApiOperation({
    summary: 'Export all personal data (GDPR Art. 20 - Data Portability)',
    description:
      'Returns all personal data associated with the authenticated user in a structured, machine-readable JSON format. Includes profile, enrollments, progress, certificates, forum posts, reviews, notifications, and more.',
  })
  @ApiResponse({
    status: 200,
    description: 'Personal data export',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportData(@Request() req: { user: { id: string } }) {
    return this.gdprService.exportUserData(req.user.id);
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete account and anonymize personal data (GDPR Art. 17 - Right to Erasure)',
    description:
      'Permanently deletes the authenticated user account. Personal data is anonymized, user-contributed content (forum posts, reviews, Q&A) is disassociated from the user, and revocable tokens are purged. This action cannot be undone.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully',
    schema: {
      example: {
        message: 'Account deleted successfully. Your personal data has been anonymized.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin accounts cannot self-delete' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteAccount(@Request() req: { user: { id: string } }) {
    return this.gdprService.deleteUserData(req.user.id);
  }
}
