import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { StellarService } from '../stellar/stellar.service';
import { MetricsService } from '../metrics/metrics.service';
import { ReputationService } from '../reputation/reputation.service';

type LeaderboardEntry = {
  userId: string;
  username: string | null;
  email: string;
  stellarPublicKey: string;
  balance: string;
  reputationScore: string;
};

@Injectable()
export class LeaderboardService {
  private readonly cacheKey = 'leaderboard:top50';
  /** 1-minute TTL in milliseconds */
  private readonly cacheTtlMs = 60_000;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stellarService: StellarService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly metricsService: MetricsService,
    private readonly reputationService: ReputationService,
  ) {}

  async getTopUsers() {
    const cached = await this.cacheManager.get<LeaderboardEntry[]>(this.cacheKey);
    if (cached) {
      this.metricsService.incrementCacheHit('leaderboard');
      return cached;
    }
    this.metricsService.incrementCacheMiss('leaderboard');

    const users = await this.userRepo.find({
      where: {},
      order: { createdAt: 'DESC' },
    });

    const walletUsers = users.filter((user) => Boolean(user.stellarPublicKey) && !user.deletedAt);

    const entries = await Promise.all(
      walletUsers.map(async (user) => {
        const [balance, reputationScore] = await Promise.all([
          this.stellarService.getTokenBalance(user.stellarPublicKey).catch(() => '0'),
          this.reputationService.getReputationScore(user.stellarPublicKey).catch(() => String(user.reputationScore ?? 0)),
        ]);
        return {
          userId: user.id,
          username: user.username ?? null,
          email: user.email,
          stellarPublicKey: user.stellarPublicKey,
          balance,
          reputationScore,
        };
      })
    );

    const leaderboard = entries
      .sort((a, b) => {
        // Primary sort: reputation score (descending)
        const repDiff = BigInt(b.reputationScore) - BigInt(a.reputationScore);
        if (repDiff !== 0n) return repDiff > 0n ? 1 : -1;
        // Secondary sort: BST balance (descending)
        const balDiff = BigInt(b.balance) - BigInt(a.balance);
        if (balDiff !== 0n) return balDiff > 0n ? 1 : -1;
        return a.email.localeCompare(b.email);
      })
      .slice(0, 50);

    await this.cacheManager.set(this.cacheKey, leaderboard, this.cacheTtlMs);
    return leaderboard;
  }
}
