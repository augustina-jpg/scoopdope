import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/course.entity';
import { Payout } from '../payouts/payout.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CurrencyConversionService } from './currency-conversion.service';
import { RoyaltyDistributionService } from './royalty-distribution.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Payout])],
  providers: [PaymentsService, CurrencyConversionService, RoyaltyDistributionService],
  controllers: [PaymentsController],
  exports: [PaymentsService, CurrencyConversionService, RoyaltyDistributionService],
})
export class PaymentsModule {}
