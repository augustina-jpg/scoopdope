import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessibilityService } from './accessibility.service';
import { AccessibilityController } from './accessibility.controller';
import { AccessibilityIssue } from './accessibility-issue.entity';
import { AccessibilityReport } from './accessibility-report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccessibilityIssue, AccessibilityReport])],
  providers: [AccessibilityService],
  controllers: [AccessibilityController],
  exports: [AccessibilityService],
})
export class AccessibilityModule {}
