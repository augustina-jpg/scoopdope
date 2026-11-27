import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payout } from './entities/payout.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { PaymentGatewayService } from '../payments/payment-gateway.service';
import { MailService } from '../mail/mail.service';

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

const MAX_PAYOUT_ATTEMPTS = 3;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly paymentGateway: PaymentGatewayService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runMonthlyPayoutJob(): Promise<void> {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);
    this.logger.log(`Starting monthly payout job for ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);

    const earnings = await this.calculateUnpaidEarnings(periodStart, periodEnd);

    for (const [instructorId, amount] of earnings) {
      if (amount <= 0) {
        continue;
      }
      const payout = await this.createPayout(instructorId, amount, periodStart, periodEnd);
      await this.processPayout(payout);
    }
  }

  async calculateUnpaidEarnings(periodStart: Date, periodEnd: Date): Promise<Map<string, number>> {
    const enrollments = await this.enrollmentRepository.find({
      where: {
        status: 'completed',
        completedAt: Between(periodStart, periodEnd),
      },
    });

    const earnings = new Map<string, number>();
    for (const enrollment of enrollments) {
      const instructorId = enrollment.instructorId;
      if (!instructorId) {
        continue;
      }
      const current = earnings.get(instructorId) ?? 0;
      earnings.set(instructorId, current + Number(enrollment.instructorEarnings ?? 0));
    }
    return earnings;
  }

  async createPayout(
    instructorId: string,
    amount: number,
    periodStart: Date,
    periodEnd: Date,
    currency = 'USD',
  ): Promise<Payout> {
    const payout = this.payoutRepository.create({
      instructorId,
      amount,
      currency,
      status: 'pending' as PayoutStatus,
      periodStart,
      periodEnd,
    });
    return this.payoutRepository.save(payout);
  }

  async processPayout(payout: Payout): Promise<Payout> {
    payout.status = 'processing';
    await this.payoutRepository.save(payout);

    try {
      const transfer = await this.paymentGateway.createTransfer({
        instructorId: payout.instructorId,
        amount: payout.amount,
        currency: payout.currency,
        reference: payout.id,
      });

      payout.status = 'paid';
      payout.gatewayReference = transfer?.id ?? null;
      payout.paidAt = new Date();
      await this.payoutRepository.save(payout);

      await this.sendConfirmationEmail(payout);
      return payout;
    } catch (error) {
      this.logger.error(`Payout ${payout.id} failed: ${(error as Error).message}`);
      payout.attempts = (payout.attempts ?? 0) + 1;

      if (payout.attempts >= MAX_PAYOUT_ATTEMPTS) {
        payout.status = 'failed';
        await this.payoutRepository.save(payout);
        this.alertFailedPayout(payout, error as Error);
      } else {
        payout.status = 'pending';
        await this.payoutRepository.save(payout);
      }
      return payout;
    }
  }

  async retryPendingPayouts(): Promise<void> {
    const pending = await this.payoutRepository.find({
      where: { status: In(['pending', 'processing']) },
    });
    for (const payout of pending) {
      if ((payout.attempts ?? 0) >= MAX_PAYOUT_ATTEMPTS) {
        payout.status = 'failed';
        await this.payoutRepository.save(payout);
        this.alertFailedPayout(payout, new Error('Max attempts exceeded'));
        continue;
      }
      await this.processPayout(payout);
    }
  }

  private async sendConfirmationEmail(payout: Payout): Promise<void> {
    try {
      await this.mailService.sendPayoutConfirmation(payout.instructorId, {
        amount: payout.amount,
        currency: payout.currency,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
      });
    } catch (error) {
      this.logger.warn(`Failed to send payout confirmation for ${payout.id}: ${(error as Error).message}`);
    }
  }

  private alertFailedPayout(payout: Payout, error: Error): void {
    this.logger.error(
      `ALERT: Payout ${payout.id} for instructor ${payout.instructorId} permanently failed after ${payout.attempts} attempts: ${error.message}`,
    );
  }
}
