import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController, AdminUsersController } from './users.controller';
import { StellarModule } from '../stellar/stellar.module';
import { AuditModule } from '../audit/audit.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => StellarModule), AuditModule, ReputationModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
