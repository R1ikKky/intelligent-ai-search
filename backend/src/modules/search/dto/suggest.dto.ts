import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestQueryDto {
  @ApiProperty({ example: 'резистар 3 ом' })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class SuggestItemDto {
  @ApiProperty({ example: 'резистор 3 ом' })
  text!: string;

  @ApiProperty({ example: 'spellfix', enum: ['spellfix', 'history', 'synonym', 'popular'] })
  kind!: string;
}

export class SuggestResponseDto {
  @ApiProperty({ example: 'резистор 3 ом' })
  normalized_query!: string;

  @ApiProperty({ type: [SuggestItemDto] })
  items!: SuggestItemDto[];
}
