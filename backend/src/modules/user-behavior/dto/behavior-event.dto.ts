import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { EventType } from '../entities/user-behavior-event.entity';

export class BehaviorEventDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'uuid-of-product' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ enum: EventType, example: EventType.CLICK })
  @IsEnum(EventType)
  eventType!: EventType;
}
