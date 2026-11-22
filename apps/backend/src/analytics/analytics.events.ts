import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsEvents {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @OnEvent('reward.earned')
  async handleRewardEarned(payload: {
    userId: string;
    amount: number;
    type: string;
    referenceId: string;
    reason: string;
    txHash: string | null;
    claimedAt: Date;
  }): Promise<void> {
    await this.analyticsService.recordRewardEvent(payload);
  }
}
