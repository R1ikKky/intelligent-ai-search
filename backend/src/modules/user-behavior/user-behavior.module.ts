import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserBehaviorEvent } from './entities/user-behavior-event.entity';
import { UserProductScore } from './entities/user-product-score.entity';
import { UserBehaviorService } from './user-behavior.service';
import { UserBehaviorController } from './user-behavior.controller';
import { ScoreUpdateJob, SCORE_UPDATE_QUEUE } from './jobs/score-update.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBehaviorEvent, UserProductScore]),
    BullModule.registerQueue({ name: SCORE_UPDATE_QUEUE }),
  ],
  controllers: [UserBehaviorController],
  providers: [UserBehaviorService, ScoreUpdateJob],
  exports: [UserBehaviorService],
})
export class UserBehaviorModule {}
