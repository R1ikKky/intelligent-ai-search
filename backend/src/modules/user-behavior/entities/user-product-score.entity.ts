import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_product_scores')
export class UserProductScore {
  @PrimaryColumn({ name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ name: 'product_id' })
  productId!: string;

  @Column({ type: 'float', default: 0 })
  score!: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated!: Date;
}
