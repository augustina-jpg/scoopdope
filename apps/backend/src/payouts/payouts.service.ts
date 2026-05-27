import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Payout } from './payout.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Course } from '../courses/course.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(Enrollment)
    private enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    private configService: ConfigService,
  ) {}

  async calculatePayouts(startDate: Date, endDate: Date): Promise<Payout[]> {
    const platformFeePercent = this.configService.get<number>('PLATFORM_FEE_PERCENT', 20);

    const courses = await this.coursesRepository.find({
      where: { instructorId: null },
      relations: ['instructor'],
    });

    const payouts: Payout[] = [];

    for (const course of courses) {
      if (!course.instructor) continue;

      const completions = await this.enrollmentsRepository.count({
        where: {
          courseId: course.id,
          completedAt: Between(startDate, endDate),
        },
      });

      if (completions === 0) continue;

      const coursePrice = this.configService.get<number>(`COURSE_PRICE_${course.id}`, 0);
      const totalRevenue = completions * coursePrice;
      const platformFee = (totalRevenue * platformFeePercent) / 100;
      const instructorShare = totalRevenue - platformFee;

      const payout = this.payoutsRepository.create({
        instructorId: course.instructor.id,
        courseId: course.id,
        totalRevenue,
        platformFee,
        instructorShare,
        status: 'pending',
        payoutDate: new Date(),
      });

      payouts.push(payout);
    }

    return this.payoutsRepository.save(payouts);
  }

  async processPayout(payoutId: string): Promise<Payout> {
    const payout = await this.payoutsRepository.findOne({
      where: { id: payoutId },
      relations: ['instructor'],
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    try {
      payout.status = 'processed';
      payout.transactionId = `TXN-${Date.now()}`;
      this.logger.log(`Payout processed for instructor ${payout.instructor.email}: $${payout.instructorShare}`);
    } catch (error) {
      payout.status = 'failed';
      this.logger.error(`Payout failed: ${error.message}`);
    }

    return this.payoutsRepository.save(payout);
  }

  async getInstructorPayouts(instructorId: string): Promise<Payout[]> {
    return this.payoutsRepository.find({
      where: { instructorId },
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPayoutStats(instructorId: string): Promise<{
    totalEarnings: number;
    pendingPayouts: number;
    processedPayouts: number;
  }> {
    const payouts = await this.payoutsRepository.find({
      where: { instructorId },
    });

    const totalEarnings = payouts.reduce((sum, p) => sum + Number(p.instructorShare), 0);
    const pendingPayouts = payouts.filter((p) => p.status === 'pending').length;
    const processedPayouts = payouts.filter((p) => p.status === 'processed').length;

    return { totalEarnings, pendingPayouts, processedPayouts };
  }

  async getPayoutHistory(instructorId: string, limit = 10): Promise<Payout[]> {
    return this.payoutsRepository.find({
      where: { instructorId },
      relations: ['course'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getMonthlyRevenue(instructorId: string): Promise<{ month: string; revenue: number }[]> {
    const payouts = await this.payoutsRepository.find({
      where: { instructorId, status: 'processed' },
      order: { payoutDate: 'ASC' },
    });

    const byMonth: Record<string, number> = {};
    for (const p of payouts) {
      const key = p.payoutDate.toISOString().slice(0, 7); // YYYY-MM
      byMonth[key] = (byMonth[key] ?? 0) + Number(p.instructorShare);
    }

    return Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
  }

  async getPerCourseRevenue(
    instructorId: string,
  ): Promise<{ courseId: string; courseTitle: string; revenue: number; payoutCount: number }[]> {
    const payouts = await this.payoutsRepository.find({
      where: { instructorId },
      relations: ['course'],
    });

    const byCourse: Record<string, { courseTitle: string; revenue: number; payoutCount: number }> = {};
    for (const p of payouts) {
      if (!byCourse[p.courseId]) {
        byCourse[p.courseId] = { courseTitle: p.course?.title ?? p.courseId, revenue: 0, payoutCount: 0 };
      }
      byCourse[p.courseId].revenue += Number(p.instructorShare);
      byCourse[p.courseId].payoutCount += 1;
    }

    return Object.entries(byCourse).map(([courseId, data]) => ({ courseId, ...data }));
  }

  async getRevenueProjection(instructorId: string): Promise<{ projectedMonthly: number; trend: 'up' | 'down' | 'stable' }> {
    const monthly = await this.getMonthlyRevenue(instructorId);
    if (monthly.length < 2) {
      return { projectedMonthly: monthly[0]?.revenue ?? 0, trend: 'stable' };
    }

    const last = monthly[monthly.length - 1].revenue;
    const prev = monthly[monthly.length - 2].revenue;
    const trend: 'up' | 'down' | 'stable' =
      last > prev * 1.05 ? 'up' : last < prev * 0.95 ? 'down' : 'stable';

    // Simple linear projection: average growth applied to last month
    const avgGrowth = monthly.slice(1).reduce((sum, m, i) => sum + (m.revenue - monthly[i].revenue), 0) / (monthly.length - 1);
    const projectedMonthly = Math.max(0, last + avgGrowth);

    return { projectedMonthly: Math.round(projectedMonthly * 100) / 100, trend };
  }
}
