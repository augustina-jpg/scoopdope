import { NotificationsEvents } from './notifications.events';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './notification.entity';
import { EmailService } from '../email/email.service';

describe('NotificationsEvents', () => {
  let events: NotificationsEvents;
  let notificationsService: any;
  let emailService: any;

  beforeEach(() => {
    notificationsService = {
      create: jest.fn(),
      onEnrollmentCreated: jest.fn(),
      onCredentialIssued: jest.fn(),
      onProgressCompleted: jest.fn(),
    };

    emailService = {
      sendApplicationReceived: jest.fn(),
      sendApplicationApproved: jest.fn(),
      sendApplicationRejected: jest.fn(),
    };

    events = new NotificationsEvents(notificationsService, emailService);
  });

  it('sends in-app notification when reward.earned event is received', async () => {
    const payload = {
      userId: 'user-1',
      amount: 25,
      type: 'module',
      reason: 'module completion reward',
    };

    await events.handleRewardEarned(payload);

    expect(notificationsService.create).toHaveBeenCalledWith(
      'user-1',
      NotificationType.REWARD_EARNED,
      'You earned 25 BST tokens for "module completion reward"',
      'Reward Earned',
    );
  });
});
