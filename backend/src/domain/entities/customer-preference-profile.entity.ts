import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_preference_profile')
export class CustomerPreferenceProfile {
  @PrimaryColumn({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @OneToOne(() => Customer, (c) => c.preferenceProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'top_categories', type: 'jsonb', default: {} })
  topCategories!: Record<string, number>;

  @Column({ name: 'top_manufacturers', type: 'jsonb', default: {} })
  topManufacturers!: Record<string, number>;

  @Column({ name: 'top_suppliers', type: 'jsonb', default: {} })
  topSuppliers!: Record<string, number>;

  @Column({ name: 'top_attributes', type: 'jsonb', default: {} })
  topAttributes!: Record<string, number>;

  @Column({ name: 'cold_start_seed_categories', type: 'jsonb', default: {} })
  coldStartSeedCategories!: Record<string, number>;

  @Column({ name: 'cold_start_seed_manufacturers', type: 'jsonb', default: {} })
  coldStartSeedManufacturers!: Record<string, number>;

  @Column({ name: 'cold_start_seed_suppliers', type: 'jsonb', default: {} })
  coldStartSeedSuppliers!: Record<string, number>;

  @Column({ name: 'seed_source', type: 'varchar', length: 64, default: 'similar_organizations' })
  seedSource!: string;

  @Column({ name: 'negative_patterns', type: 'jsonb', default: {} })
  negativePatterns!: Record<string, unknown>;

  @Column({ name: 'query_embedding_centroid', type: 'float', array: true, nullable: true })
  queryEmbeddingCentroid?: number[] | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
