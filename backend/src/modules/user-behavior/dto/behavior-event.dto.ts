import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '../entities/user-behavior-event.entity';

// Legacy single-event DTO (kept for internal use)
export class BehaviorEventDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'ste-id-or-product-id' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ enum: EventType, example: EventType.CLICK })
  @IsEnum(EventType)
  eventType!: EventType;
}

// Bulk events DTO matching spec §16.5
export class BulkEventItemDto {
  @ApiProperty({ description: 'Idempotency key', example: 'uuid' })
  @IsUUID()
  event_id!: string;

  @ApiProperty({
    description: 'Event type',
    example: 'product_view_end',
    enum: [
      'search_submit', 'search_results_dwell', 'product_view_end',
      'suggestion_selected', 'product_card_click', 'back_to_results',
      'query_reformulation',
      // legacy event types mapped internally
      'view', 'click', 'order', 'bookmark',
    ],
  })
  @IsString()
  @IsNotEmpty()
  event_type!: string;

  @ApiPropertyOptional({ example: 'search-query-uuid' })
  @IsOptional()
  @IsString()
  search_query_id?: string;

  @ApiPropertyOptional({ example: 'ste-id-123' })
  @IsOptional()
  @IsString()
  ste_id?: string;

  @ApiProperty({ example: '2026-04-04T14:10:00Z' })
  @IsDateString()
  event_at!: string;

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @IsInt()
  dwell_ms?: number;

  @ApiPropertyOptional({ example: 32000 })
  @IsOptional()
  @IsInt()
  active_time_ms?: number;

  @ApiPropertyOptional({ description: 'Extra payload' })
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class BulkEventsDto {
  @ApiProperty({ description: 'Session ID', example: 'uuid' })
  @IsUUID()
  session_id!: string;

  @ApiProperty({ type: [BulkEventItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkEventItemDto)
  events!: BulkEventItemDto[];
}
