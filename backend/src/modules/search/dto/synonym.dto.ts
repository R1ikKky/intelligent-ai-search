import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateSynonymDto {
  @ApiProperty({ type: [String], example: ['бумага', 'paper', 'лист'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  terms!: string[];
}

export class SynonymGroupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: [String] })
  terms!: string[];
}
