import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payout } from './entities/payout.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { PaymentGatewayService } from '../payments/payment-gateway.service';
import { MailService } from '../mail/mail.service';

const MAX_PAYOUT_ATTEMPTS = 3;

@Injectable()
 export class PayoutsCron {
  private readonly logger = new Logger(PayoutsCron.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly paymentGateway: PaymentGatewayService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runMonthlyPayouts(): Promise<void> {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);

    this.logger.log(`Starting monthly payout run for ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);

    const earnings = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .select('enrollment.instructorId', 'instructorId')
      .addSelect('SUM(enrollment.instructorEarnings)', 'amount')
      .addSelect('enrollment.currency', 'currency')
      .where('enrollment.status = :status', { status: 'completed' })
      .andWhere('enrollment.completedAt BETWEEN :start AND :end', { start: periodStart, end: periodEnd })
      .andWhere('enrollment.payoutId IS NULL')
      .groupBy('enrollment.instructorId')
      .addGroupBy('enrollment.currency')
      .getRawMany<{ instructorId: string; amount: string; currency: string }>();

    for (const earning of earnings) {
      const amount = Number(earning.amount);
      if (!amount || amount <= 0) {
        continue;
      }

      const payout = this.payoutRepository.create({
        instructorId: earning.instructorId,
        amount,
        currency: earning.currency,
        status: 'pending',
        periodStart,
        periodEnd,
      });
      await this.payoutRepository.save(payout);
      await this.processPayout(payout);
    }

    this.logger.log(`Monthly payout run finished: ${earnings.length} instructor(s) processed`);
  }

  private async processPayout(payout: Payout): Promise<void> {
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
      payout.gatewayReference = transfer.id;
      await this.payoutRepository.save(payout);

      await this.mailService.sendPayoutConfirmation(payout.instructorId, {
        amount: payout.amount,
        currency: payout.currency,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
      });
    } catch (error) {
      await this.handleFailure(payout, error);
    }
  }

  private async handleFailure(payout: Payout, error: unknown): Promise<void> {
    payout.attempts = (payout.attempts ?? 0) + 1;
    payout.lastError = error instanceof Error ? error.message : String(error);

    if (payout.attempts >= MAX_PAYOUT_ATTEMPTS) {
      payout.status = 'failed';
      this.logger.error(
        `Payout ${payout.id} for instructor ${payout.instructorId} failed permanently after ${payout.attempts} attempts: ${payout.lastError}`,
      );
    } else {
      payout.status = 'pending';
      this.logger.warn(
        `Payout ${payout.id} for instructor ${payout.instructorId} failed (attempt ${payout.attempts}/${MAX_PAYOUT_ATTEMPTS}): ${payout.lastError}`,
      );
    }

    await this.payoutRepository.save(payout);
  }
}
