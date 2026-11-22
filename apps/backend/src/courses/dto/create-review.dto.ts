import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trim, Sanitize } from 'class-sanitizer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { StripHtmlSanitizer } from '../../common/sanitizers/strip-html.sanitizer';

export class CreateReviewDto {
  @ApiProperty({ description: 'Course rating from 1 to 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review text', maxLength: 1000 })
  @ValidateIf((dto: CreateReviewDto) => !dto.comment)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  text: string;

  @ApiPropertyOptional({ description: 'Deprecated alias for text' })
  @ValidateIf((dto: CreateReviewDto) => !dto.text)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Trim()
  @Sanitize(StripHtmlSanitizer)
  comment?: string;
}
