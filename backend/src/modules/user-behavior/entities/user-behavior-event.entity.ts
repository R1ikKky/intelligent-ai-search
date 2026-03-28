import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum EventType {
  VIEW = 'view',
  CLICK = 'click',
  ORDER = 'order',
  BOOKMARK = 'bookmark',
}

export const EVENT_WEIGHTS: Record<EventType, number> = {
  [EventType.ORDER]: 10,
  [EventType.BOOKMARK]: 5,
  [EventType.CLICK]: 2,
  [EventType.VIEW]: 1,
};

@Entity('user_behavior_events')
@Index(['userId', 'productId'])
export class UserBehaviorEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Index()
  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ name: 'event_type', type: 'enum', enum: EventType })
  eventType!: EventType;

  @Column({ type: 'float' })
  weight!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
