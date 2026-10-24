import { AnalyticsEvents } from './analytics.events';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsEvents', () => {
  let events: AnalyticsEvents;
  let analyticsService: any;

  beforeEach(() => {
    analyticsService = {
      recordRewardEvent: jest.fn(),
    };

    events = new AnalyticsEvents(analyticsService);
  });

  it('records reward event when reward.earned event is received', async () => {
    const payload = {
      userId: 'user-1',
      amount: 25,
      type: 'module',
      referenceId: 'module-1',
      reason: 'module completion reward',
      txHash: 'tx-hash-123',
      claimedAt: new Date(),
    };

    await events.handleRewardEarned(payload);

    expect(analyticsService.recordRewardEvent).toHaveBeenCalledWith(payload);
  });
});
