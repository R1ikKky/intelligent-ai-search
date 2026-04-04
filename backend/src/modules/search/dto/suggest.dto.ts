import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestQueryDto {
  @ApiPropertyOptional({ description: 'Search session ID' })
  @IsOptional()
  @IsUUID()
  session_id?: string;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  include_spellfix?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  include_synonyms?: boolean = true;
}

export class SuggestItemDto {
  @ApiProperty({ example: 'резистор 3 ом' })
  text!: string;

  @ApiProperty({ example: 'spellfix', enum: ['spellfix', 'popular', 'synonym', 'category'] })
  kind!: string;

  @ApiProperty({ type: [String], example: ['TYPO_CORRECTION', 'CAN_REPLACE_QUERY'] })
  flags!: string[];

  @ApiProperty({ example: 0.96 })
  score!: number;
}

export class SuggestResponseDto {
  @ApiProperty({ example: 'резистар 3 ом' })
  query!: string;

  @ApiProperty({ type: [SuggestItemDto] })
  items!: SuggestItemDto[];
}
