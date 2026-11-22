import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ReviewQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['recent', 'highest'], default: 'recent' })
  @IsOptional()
  @IsIn(['recent', 'highest'])
  sort?: 'recent' | 'highest' = 'recent';

  limit?: number = 10;
}
