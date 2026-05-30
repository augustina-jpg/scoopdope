import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { StellarService } from '../stellar/stellar.service';
import { AuditService } from '../audit/audit.service';
import { ReputationService } from '../reputation/reputation.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly stellarService: StellarService,
    private readonly auditService: AuditService,
    private readonly reputationService: ReputationService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin-only')
  adminOnly() {
    return { message: 'Admin access granted' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user data' })
  async getMe(@Request() req: { user: { id: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns user data',
    schema: { example: { data: {}, statusCode: 200, timestamp: '2024-01-01T00:00:00.000Z' } },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id/token-balance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get BST token balance for a user' })
  @ApiResponse({
    status: 200,
    description: 'Returns BST token balance',
    schema: { example: { balance: '1000', stellarPublicKey: 'G...' } },
  })
  @ApiResponse({ status: 404, description: 'User not found or no Stellar key linked' })
  async getTokenBalance(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!user.stellarPublicKey)
      throw new NotFoundException('User has no Stellar public key linked');
    const balance = await this.stellarService.getTokenBalance(user.stellarPublicKey);
    return { balance, stellarPublicKey: user.stellarPublicKey };
  }

  @Get(':id/reputation')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get on-chain reputation score for a user' })
  @ApiResponse({
    status: 200,
    description: 'Returns on-chain reputation score and cached DB score',
    schema: { example: { reputationScore: '250', stellarPublicKey: 'G...' } },
  })
  @ApiResponse({ status: 404, description: 'User not found or no Stellar key linked' })
  async getReputation(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!user.stellarPublicKey)
      throw new NotFoundException('User has no Stellar public key linked');
    const reputationScore = await this.reputationService.getReputationScore(user.stellarPublicKey);
    // Sync cached score to DB
    await this.usersService.update(id, { reputationScore: Number(reputationScore) });
    return { reputationScore, stellarPublicKey: user.stellarPublicKey };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/referrals')
  @ApiOperation({ summary: 'Get referral count and earned BST for a user' })
  getReferrals(@Param('id') id: string) {
    return this.usersService.getReferralStats(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { id: string } }
  ) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/export')
  @ApiOperation({ summary: 'Export all personal data (GDPR)' })
  @ApiResponse({ status: 200, description: 'Returns all user data in JSON format' })
  async exportData(@Request() req: { user: { id: string } }) {
    const data = await this.usersService.exportUserData(req.user.id);
    await this.auditService.log('gdpr.data_export', req.user.id, true);
    return data;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/account')
  @ApiOperation({ summary: 'Delete account and anonymize personal data (GDPR)' })
  @ApiResponse({ status: 200, description: 'Account deletion initiated' })
  async deleteAccount(@Request() req: { user: { id: string } }) {
    await this.usersService.anonymizeUser(req.user.id);
    await this.auditService.log('gdpr.account_deletion', req.user.id, true);
    return { message: 'Account deletion initiated. Your personal data has been anonymized.' };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated users',
    schema: {
      example: {
        data: { users: [], total: 0, page: 1, limit: 10 },
        statusCode: 200,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
    @Query('isVerified') isVerified?: string,
    @Query('search') search?: string
  ) {
    return this.usersService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      role,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
      search,
    });
  }

  @Patch(':id/role')
  @Roles('admin')
  @ApiOperation({ summary: 'Change user role' })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    schema: { example: { data: {}, statusCode: 200, timestamp: '2024-01-01T00:00:00.000Z' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  changeRole(@Param('id') id: string, @Body('role') role: string) {
    return this.usersService.changeRole(id, role);
  }

  @Patch(':id/ban')
  @Roles('admin')
  @ApiOperation({ summary: 'Ban or unban a user' })
  @ApiResponse({
    status: 200,
    description: 'User ban status updated',
    schema: { example: { data: {}, statusCode: 200, timestamp: '2024-01-01T00:00:00.000Z' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  banUser(@Param('id') id: string, @Body('isBanned') isBanned: boolean) {
    return this.usersService.banUser(id, isBanned);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: { example: { data: {}, statusCode: 200, timestamp: '2024-01-01T00:00:00.000Z' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }
}
