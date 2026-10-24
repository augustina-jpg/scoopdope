import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ModerationAppealsService } from './moderation-appeals.service';
import { ResolveModerationAppealDto, SubmitModerationAppealDto } from './dto/moderation.dto';

@ApiTags('moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('moderation/appeals')
export class ModerationAppealsController {
  constructor(private readonly appealsService: ModerationAppealsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit an appeal for removed content' })
  submit(
    @Body() dto: SubmitModerationAppealDto,
    @Request() req: { user: { id: string } }
  ) {
    return this.appealsService.submit(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List pending moderation appeals' })
  getPending() {
    return this.appealsService.getPending();
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Accept or reject a moderation appeal' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveModerationAppealDto,
    @Request() req: { user: { id: string } }
  ) {
    return this.appealsService.resolve(id, dto, req.user.id);
  }
}