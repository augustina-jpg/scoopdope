import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { RewardType } from './reward.entity';

describe('RewardsService', () => {
  let service: RewardsService;
  let userRepo: any;
  let historyRepo: any;
  let stellarService: any;
  let configService: any;
  let eventEmitter: any;

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    historyRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    stellarService = {
      mintReward: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, fallback?: number) => {
        const values: Record<string, number> = {
          'rewards.moduleCompletion': 25,
          'rewards.courseCompletion': 100,
        };
        return values[key] ?? fallback ?? 0;
      }),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    service = new RewardsService(userRepo, historyRepo, stellarService, configService, eventEmitter);
  });

  it('calculates reward amounts by tier', () => {
    expect(service.calculateEarnedTokens(RewardType.MODULE)).toBe(25);
    expect(service.calculateEarnedTokens(RewardType.COURSE)).toBe(100);
  });

  it('claims a reward, mints tokens, and updates the user balance', async () => {
    const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 0 };
    userRepo.findOne.mockResolvedValue(user);
    historyRepo.findOne.mockResolvedValue(null);
    historyRepo.create.mockImplementation((data) => data);
    historyRepo.save.mockImplementation(async (data) => data);
    userRepo.save.mockImplementation(async (data) => data);
    stellarService.mintReward.mockResolvedValue('tx-hash-123');

    const result = await service.claim(user.id, {
      type: RewardType.MODULE,
      referenceId: 'module-1',
    });

    expect(stellarService.mintReward).toHaveBeenCalledWith('GTEST', 25);
    expect(user.rewardBalance).toBe(25);
    expect(result.amount).toBe(25);
    expect(result.txHash).toBe('tx-hash-123');
  });

  it('emits reward.earned event when tokens are minted', async () => {
    const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 0 };
    userRepo.findOne.mockResolvedValue(user);
    historyRepo.findOne.mockResolvedValue(null);
    historyRepo.create.mockImplementation((data) => data);
    historyRepo.save.mockImplementation(async (data) => data);
    userRepo.save.mockImplementation(async (data) => data);
    stellarService.mintReward.mockResolvedValue('tx-hash-123');

    await service.claim(user.id, {
      type: RewardType.MODULE,
      referenceId: 'module-1',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith('reward.earned', expect.objectContaining({
      userId: 'user-1',
      amount: 25,
      type: RewardType.MODULE,
      referenceId: 'module-1',
      reason: 'module completion reward',
      txHash: 'tx-hash-123',
    }));
  });

  it('prevents duplicate claims for the same reference', async () => {
    const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 25 };
    userRepo.findOne.mockResolvedValue(user);
    historyRepo.findOne.mockResolvedValue({
      userId: user.id,
      type: RewardType.MODULE,
      referenceId: 'module-1',
      amount: 25,
      txHash: 'existing-tx',
    });

    await expect(
      service.claim(user.id, {
        type: RewardType.MODULE,
        referenceId: 'module-1',
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects claim attempts for another user', async () => {
    const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 0 };
    userRepo.findOne.mockResolvedValue(user);

    await expect(
      service.claim('user-2', {
        type: RewardType.COURSE,
        referenceId: 'course-1',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('rollback', () => {
    it('rolls back a reward and emits reward.rolled_back event', async () => {
      const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 25 };
      const reward = {
        id: 'reward-1',
        userId: 'user-1',
        type: RewardType.MODULE,
        referenceId: 'module-1',
        amount: 25,
        reason: 'module completion reward',
        txHash: 'tx-hash-123',
      };

      userRepo.findOne.mockResolvedValue(user);
      historyRepo.findOne.mockResolvedValue(reward);

      await service.rollback('reward-1', 'user-1');

      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        rewardBalance: 0,
      }));
      expect(historyRepo.remove).toHaveBeenCalledWith(reward);
      expect(eventEmitter.emit).toHaveBeenCalledWith('reward.rolled_back', expect.objectContaining({
        userId: 'user-1',
        amount: 25,
        type: RewardType.MODULE,
        referenceId: 'module-1',
        reason: 'module completion reward',
        rewardId: 'reward-1',
      }));
    });

    it('throws NotFoundException when reward is not found', async () => {
      const user = { id: 'user-1', stellarPublicKey: 'GTEST', rewardBalance: 25 };
      userRepo.findOne.mockResolvedValue(user);
      historyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rollback('nonexistent-reward', 'user-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when user is not found', async () => {
      historyRepo.findOne.mockResolvedValue({
        id: 'reward-1',
        userId: 'user-1',
        type: RewardType.MODULE,
        referenceId: 'module-1',
        amount: 25,
        reason: 'module completion reward',
        txHash: 'tx-hash-123',
      });
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rollback('reward-1', 'user-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
