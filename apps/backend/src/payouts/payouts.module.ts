import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { Payout } from './payout.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Course } from '../courses/course.entity';
import { RoyaltyDistributionService } from '../payments/royalty-distribution.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payout, Enrollment, Course])],
  providers: [PayoutsService, RoyaltyDistributionService],
  controllers: [PayoutsController],
  exports: [PayoutsService, RoyaltyDistributionService],
})
export class PayoutsModule {}
