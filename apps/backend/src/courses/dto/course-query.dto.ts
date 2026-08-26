import { IsOptional, IsString, IsIn, IsNumber, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Trim, Sanitize } from 'class-sanitizer';
import { StripHtmlSanitizer } from '../../common/sanitizers/strip-html.sanitizer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CourseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Full-text search on title and description' })
  @IsOptional()
  @IsString()
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  search?: string;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced'],
    description: 'Filter by course level',
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  level?: string;

  @ApiPropertyOptional({ description: 'Filter by BCP-47 language code (e.g. "en", "es", "fr")' })
  @IsOptional()
  @IsString()
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  language?: string;

  @ApiPropertyOptional({ description: 'Filter by instructor username (partial match)' })
  @IsOptional()
  @IsString()
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  instructor?: string;

  @ApiPropertyOptional({ description: 'Minimum average rating (0–5)', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Minimum enrollment count', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minEnrollments?: number;

  @ApiPropertyOptional({ description: 'Maximum enrollment count', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxEnrollments?: number;

  @ApiPropertyOptional({ description: 'Filter courses published after this ISO date string' })
  @IsOptional()
  @IsString()
  @Trim()
  publishedAfter?: string;

  @ApiPropertyOptional({ description: 'Filter courses published before this ISO date string' })
  @IsOptional()
  @IsString()
  @Trim()
  publishedBefore?: string;

  @ApiPropertyOptional({ description: 'Minimum duration in hours', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Maximum duration in hours', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMax?: number;

  @ApiPropertyOptional({ description: 'Minimum price in USD', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum price in USD (0 = free only)', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['newest', 'oldest', 'popular', 'rating'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'oldest', 'popular', 'rating'])
  sort?: string;
}
