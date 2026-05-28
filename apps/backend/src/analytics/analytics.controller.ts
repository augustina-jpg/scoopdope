import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('analytics/platform')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get platform-wide analytics (admin only)' })
  getPlatformAnalytics() {
    return this.service.getPlatformAnalytics();
  }

  @Get('courses/:id/analytics')
  @ApiOperation({ summary: 'Get aggregated analytics for a course' })
  getAnalytics(@Param('id') id: string) {
    return this.service.getAnalytics(id);
  }

  @Post('courses/:id/analytics/refresh')
  @ApiOperation({ summary: 'Force refresh analytics for a course' })
  refresh(@Param('id') id: string) {
    return this.service.aggregateCourse(id);
  }
}
