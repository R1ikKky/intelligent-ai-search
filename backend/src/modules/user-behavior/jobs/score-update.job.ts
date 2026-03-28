import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UserBehaviorService } from '../user-behavior.service';

export const SCORE_UPDATE_QUEUE = 'score-update';

export interface ScoreUpdateJobData {
  userId: string;
  productId: string;
}

@Processor(SCORE_UPDATE_QUEUE)
export class ScoreUpdateJob extends WorkerHost {
  private readonly logger = new Logger(ScoreUpdateJob.name);

  constructor(private readonly behaviorService: UserBehaviorService) {
    super();
  }

  async process(job: Job<ScoreUpdateJobData>): Promise<void> {
    const { userId, productId } = job.data;
    this.logger.debug(`Updating score for user=${userId} product=${productId}`);
    await this.behaviorService.updateScore(userId, productId);
  }
}
