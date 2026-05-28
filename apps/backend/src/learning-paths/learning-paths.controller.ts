import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LearningPathsService } from './learning-paths.service';
import { CreateLearningPathDto, UpdateLearningPathDto } from './dto/learning-path.dto';

@ApiTags('learning-paths')
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly service: LearningPathsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all published learning paths' })
  findAll() {
    return this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get learning path by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll in a learning path' })
  enroll(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.service.enroll(req.user.id, id);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user learning path enrollments' })
  getMyEnrollments(@Request() req: { user: { id: string } }) {
    return this.service.getEnrollments(req.user.id);
  }
}

@ApiTags('admin/learning-paths')
@Controller('admin/learning-paths')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class AdminLearningPathsController {
  constructor(private readonly service: LearningPathsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all learning paths (including unpublished)' })
  findAll() {
    return this.service.findAll(false);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new learning path' })
  create(@Body() dto: CreateLearningPathDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a learning path' })
  update(@Param('id') id: string, @Body() dto: UpdateLearningPathDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a learning path' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
