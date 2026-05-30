import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Payout } from '../payouts/payout.entity';
import { Course } from '../courses/course.entity';

export interface PaymentSucceededEvent {
  courseId: string;
  userId: string;
  amountUsd: number;
}

@Injectable()
export class RoyaltyDistributionService {
  private readonly logger = new Logger(RoyaltyDistributionService.name);

  constructor(
    @InjectRepository(Payout)
    private payoutsRepo: Repository<Payout>,
    @InjectRepository(Course)
    private coursesRepo: Repository<Course>,
  ) {}

  /**
   * Triggered when a payment succeeds (via EventEmitter).
   * Creates a pending payout record for the instructor.
   */
  @OnEvent('payment.succeeded')
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    try {
      await this.distributeRoyalty(event.courseId, event.amountUsd);
    } catch (err) {
      this.logger.error(
        `Royalty distribution failed for course ${event.courseId}: ${err.message}`,
      );
    }
  }

  async distributeRoyalty(courseId: string, amountUsd: number): Promise<Payout> {
    const course = await this.coursesRepo.findOne({
      where: { id: courseId },
      relations: ['instructor'],
    });

    if (!course) throw new NotFoundException(`Course ${courseId} not found`);
    if (!course.instructor) {
      throw new NotFoundException(`Course ${courseId} has no instructor`);
    }

    const royaltyPct = course.royaltyPercentage ?? 80;
    const platformPct = 100 - royaltyPct;
    const instructorShare = (amountUsd * royaltyPct) / 100;
    const platformFee = (amountUsd * platformPct) / 100;

    const payout = this.payoutsRepo.create({
      instructorId: course.instructor.id,
      courseId: course.id,
      totalRevenue: amountUsd,
      platformFee,
      instructorShare,
      status: 'pending',
      payoutDate: new Date(),
    });

    const saved = await this.payoutsRepo.save(payout);
    this.logger.log(
      `Royalty distributed: course=${courseId} instructor=${course.instructor.id} share=$${instructorShare}`,
    );
    return saved;
  }

  /**
   * Get earnings summary for an instructor across all courses.
   */
  async getInstructorEarnings(instructorId: string): Promise<{
    totalEarnings: number;
    pendingAmount: number;
    processedAmount: number;
    courseBreakdown: { courseId: string; courseTitle: string; earnings: number }[];
  }> {
    const payouts = await this.payoutsRepo.find({
      where: { instructorId },
      relations: ['course'],
    });

    const totalEarnings = payouts.reduce((s, p) => s + Number(p.instructorShare), 0);
    const pendingAmount = payouts
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + Number(p.instructorShare), 0);
    const processedAmount = payouts
      .filter((p) => p.status === 'processed')
      .reduce((s, p) => s + Number(p.instructorShare), 0);

    const byCoursMap: Record<string, { courseTitle: string; earnings: number }> = {};
    for (const p of payouts) {
      if (!byCoursMap[p.courseId]) {
        byCoursMap[p.courseId] = {
          courseTitle: p.course?.title ?? p.courseId,
          earnings: 0,
        };
      }
      byCoursMap[p.courseId].earnings += Number(p.instructorShare);
    }

    const courseBreakdown = Object.entries(byCoursMap).map(([courseId, d]) => ({
      courseId,
      ...d,
    }));

    return { totalEarnings, pendingAmount, processedAmount, courseBreakdown };
  }
}
