import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BulkEventsDto } from './dto/behavior-event.dto';
import { UserBehaviorService } from './user-behavior.service';
import { SCORE_UPDATE_QUEUE, ScoreUpdateJobData } from './jobs/score-update.job';
import { UserProductScore } from './entities/user-product-score.entity';
import { EventType } from './entities/user-behavior-event.entity';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// Maps frontend event_type strings → internal scoring EventType.
// null = telemetry-only, no score update needed.
const EVENT_TYPE_MAP: Record<string, EventType | null> = {
  order: EventType.ORDER,
  bookmark: EventType.BOOKMARK,
  click: EventType.CLICK,
  view: EventType.VIEW,
  product_view_end: EventType.CLICK,   // upgraded by dwell below
  suggestion_selected: EventType.CLICK,
  product_card_click: EventType.CLICK,
  search_submit: null,
  search_results_dwell: null,
  back_to_results: null,
  query_reformulation: null,
};

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class UserBehaviorController {
  constructor(
    private readonly behaviorService: UserBehaviorService,
    @InjectQueue(SCORE_UPDATE_QUEUE) private readonly scoreQueue: Queue<ScoreUpdateJobData>,
  ) {}

  /**
   * POST /events/bulk
   * Batch ingest of frontend telemetry events (spec §16.5).
   * Upgrades product_view_end weight based on active_time_ms:
   *   > 60 000 ms → ORDER weight (10)
   *   > 25 000 ms → BOOKMARK weight (5)
   *   default      → CLICK weight (2)
   */
  @Post('bulk')
  @ApiOperation({ summary: 'Batch ingest user interaction events (spec §16.5)' })
  @ApiResponse({
    status: 201,
    schema: { example: { accepted: 3, queued_profile_recalc: true } },
  })
  async bulkEvents(
    @Body() dto: BulkEventsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ accepted: number; queued_profile_recalc: boolean }> {
    const userId = user.userId;
    const profileUpdateTargets = new Set<string>();

    for (const ev of dto.events) {
      let internalType = EVENT_TYPE_MAP[ev.event_type] ?? null;

      // Dwell-based weight upgrade for product views
      if (ev.event_type === 'product_view_end' && ev.active_time_ms) {
        if (ev.active_time_ms > 60_000) internalType = EventType.ORDER;
        else if (ev.active_time_ms > 25_000) internalType = EventType.BOOKMARK;
      }

      if (internalType && ev.ste_id) {
        await this.behaviorService.recordEvent(userId, ev.ste_id, internalType);
        profileUpdateTargets.add(ev.ste_id);
      }
    }

    for (const productId of profileUpdateTargets) {
      await this.scoreQueue.add('update-score', { userId, productId });
    }

    return { accepted: dto.events.length, queued_profile_recalc: profileUpdateTargets.size > 0 };
  }

  @Get('scores/:userId')
  @ApiOperation({ summary: 'Get top product scores for a user (internal debug)' })
  @ApiParam({ name: 'userId', example: 'user-1' })
  @ApiResponse({ status: 200, type: [UserProductScore] })
  async getScores(@Param('userId') userId: string): Promise<UserProductScore[]> {
    return this.behaviorService.getScoresForUser(userId);
  }
}
