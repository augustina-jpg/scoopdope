import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdaptiveLearningService } from './adaptive-learning.service';

@ApiTags('adaptive-learning')
@Controller('adaptive-learning')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdaptiveLearningController {
  constructor(private readonly service: AdaptiveLearningService) {}

  @Post('record')
  @ApiOperation({ summary: 'Record quiz result and update difficulty' })
  recordResult(
    @Request() req,
    @Body() body: { topicId: string; score: number },
  ) {
    return this.service.recordQuizResult(req.user.id, body.topicId, body.score);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get remedial content recommendations for weak topics' })
  getRecommendations(@Request() req) {
    return this.service.getRecommendations(req.user.id);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get student performance across all topics' })
  getPerformance(@Request() req) {
    return this.service.getPerformance(req.user.id);
  }

  @Get('ab-test/:experiment')
  @ApiOperation({ summary: 'Get or assign A/B test variant for current user' })
  getVariant(@Request() req, @Param('experiment') experiment: string) {
    return this.service.getOrAssignVariant(req.user.id, experiment);
  }

  @Post('ab-test/:experiment/outcome')
  @ApiOperation({ summary: 'Record A/B test outcome score' })
  recordOutcome(
    @Request() req,
    @Param('experiment') experiment: string,
    @Body() body: { score: number },
  ) {
    return this.service.recordAbOutcome(req.user.id, experiment, body.score);
  }

  @Get('ab-test/:experiment/results')
  @ApiOperation({ summary: 'Get A/B test aggregate results' })
  getAbResults(@Param('experiment') experiment: string) {
    return this.service.getAbTestResults(experiment);
  }
}
