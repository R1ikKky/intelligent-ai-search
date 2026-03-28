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
import { BehaviorEventDto } from './dto/behavior-event.dto';
import { UserBehaviorService } from './user-behavior.service';
import { SCORE_UPDATE_QUEUE, ScoreUpdateJobData } from './jobs/score-update.job';
import { UserProductScore } from './entities/user-product-score.entity';

@ApiTags('Behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('behavior')
export class UserBehaviorController {
  constructor(
    private readonly behaviorService: UserBehaviorService,
    @InjectQueue(SCORE_UPDATE_QUEUE) private readonly scoreQueue: Queue<ScoreUpdateJobData>,
  ) {}

  @Post('event')
  @ApiOperation({ summary: 'Record a user interaction event' })
  @ApiResponse({ status: 201, schema: { example: { queued: true } } })
  async recordEvent(@Body() dto: BehaviorEventDto): Promise<{ queued: boolean }> {
    await this.behaviorService.recordEvent(dto.userId, dto.productId, dto.eventType);
    await this.scoreQueue.add('update-score', {
      userId: dto.userId,
      productId: dto.productId,
    });
    return { queued: true };
  }

  @Get('scores/:userId')
  @ApiOperation({ summary: 'Get top product scores for a user' })
  @ApiParam({ name: 'userId', example: 'user-1' })
  @ApiResponse({ status: 200, type: [UserProductScore] })
  async getScores(@Param('userId') userId: string): Promise<UserProductScore[]> {
    return this.behaviorService.getScoresForUser(userId);
  }
}
