import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EventType,
  EVENT_WEIGHTS,
  UserBehaviorEvent,
} from './entities/user-behavior-event.entity';
import { UserProductScore } from './entities/user-product-score.entity';

const ROLLING_WINDOW_DAYS = 90;

@Injectable()
export class UserBehaviorService {
  constructor(
    @InjectRepository(UserBehaviorEvent)
    private readonly eventRepo: Repository<UserBehaviorEvent>,
    @InjectRepository(UserProductScore)
    private readonly scoreRepo: Repository<UserProductScore>,
  ) {}

  async recordEvent(userId: string, productId: string, eventType: EventType): Promise<void> {
    const weight = EVENT_WEIGHTS[eventType];
    await this.eventRepo.save(
      this.eventRepo.create({ userId, productId, eventType, weight }),
    );
  }

  async updateScore(userId: string, productId: string): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - ROLLING_WINDOW_DAYS);

    const result = await this.eventRepo
      .createQueryBuilder('e')
      .select('SUM(e.weight)', 'total')
      .where('e.user_id = :userId AND e.product_id = :productId AND e.created_at >= :since', {
        userId,
        productId,
        since,
      })
      .getRawOne<{ total: string }>();

    const score = parseFloat(result?.total ?? '0');

    await this.scoreRepo
      .createQueryBuilder()
      .insert()
      .into(UserProductScore)
      .values({ userId, productId, score })
      .orUpdate(['score', 'last_updated'], ['user_id', 'product_id'])
      .execute();
  }

  async getScoresForUser(userId: string): Promise<UserProductScore[]> {
    return this.scoreRepo.find({
      where: { userId },
      order: { score: 'DESC' },
      take: 100,
    });
  }

  async getScoreMap(userId: string, productIds: string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();

    const scores = await this.scoreRepo
      .createQueryBuilder('s')
      .where('s.user_id = :userId AND s.product_id IN (:...productIds)', {
        userId,
        productIds,
      })
      .getMany();

    return new Map(scores.map((s) => [s.productId, s.score]));
  }

  async getCategoryOrderCounts(userId: string): Promise<Map<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - ROLLING_WINDOW_DAYS);

    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .innerJoin('products', 'p', 'p.id = e.product_id')
      .select('p.category', 'category')
      .addSelect('COUNT(*)', 'cnt')
      .where("e.user_id = :userId AND e.event_type = 'order' AND e.created_at >= :since", {
        userId,
        since,
      })
      .groupBy('p.category')
      .getRawMany<{ category: string; cnt: string }>();

    return new Map(rows.map((r) => [r.category, parseInt(r.cnt, 10)]));
  }
}
