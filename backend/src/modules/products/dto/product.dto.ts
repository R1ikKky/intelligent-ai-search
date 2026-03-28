import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

@Exclude()
export class ProductDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  externalId!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty()
  description!: string;

  @Expose()
  @ApiProperty()
  category!: string;

  @Expose()
  @ApiProperty()
  unit!: string;

  @Expose()
  @ApiPropertyOptional()
  price?: number;

  @Expose()
  @ApiProperty({ type: [String] })
  synonyms!: string[];
}

export class SearchResultItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  unit!: string;

  @ApiPropertyOptional()
  price?: number;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  personalizedScore!: number;

  @ApiProperty()
  isPersonalized!: boolean;
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultItemDto] })
  items!: SearchResultItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiPropertyOptional({ nullable: true })
  suggestion!: string | null;
}
