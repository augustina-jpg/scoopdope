import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeaderboardService } from './leaderboard.service';

@Injectable()
export class LeaderboardEvents {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @OnEvent('reward.earned')
  async handleRewardEarned(): Promise<void> {
    await this.leaderboardService.invalidateLeaderboardCache();
  }
}
