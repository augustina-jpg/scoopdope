import { LeaderboardEvents } from './leaderboard.events';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardEvents', () => {
  let events: LeaderboardEvents;
  let leaderboardService: any;

  beforeEach(() => {
    leaderboardService = {
      invalidateLeaderboardCache: jest.fn(),
    };

    events = new LeaderboardEvents(leaderboardService);
  });

  it('invalidates leaderboard cache when reward.earned event is received', async () => {
    await events.handleRewardEarned();

    expect(leaderboardService.invalidateLeaderboardCache).toHaveBeenCalledTimes(1);
  });
});
