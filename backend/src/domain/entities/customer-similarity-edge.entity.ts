import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CustomerData } from './customer-data.entity';

@Entity('customer_similarity_edge')
export class CustomerSimilarityEdge {
  @PrimaryColumn({ name: 'source_customer_data_id', type: 'varchar', length: 12 })
  sourceCustomerDataId!: string;

  @PrimaryColumn({ name: 'neighbor_customer_data_id', type: 'varchar', length: 12 })
  neighborCustomerDataId!: string;

  @ManyToOne(() => CustomerData, (c) => c.similarityOut, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_customer_data_id' })
  sourceCustomerData!: CustomerData;

  @ManyToOne(() => CustomerData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'neighbor_customer_data_id' })
  neighborCustomerData!: CustomerData;

  @Column({ name: 'similarity_score', type: 'float' })
  similarityScore!: number;

  @Column({ name: 'same_region', type: 'boolean', default: false })
  sameRegion!: boolean;

  @Column({ name: 'same_org_type', type: 'boolean', default: false })
  sameOrgType!: boolean;

  @Column({ name: 'name_similarity', type: 'float', default: 0 })
  nameSimilarity!: number;

  @Column({ name: 'purchase_similarity', type: 'float', default: 0 })
  purchaseSimilarity!: number;

  @Column({ type: 'jsonb', default: {} })
  features!: Record<string, unknown>;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt!: Date;
}
