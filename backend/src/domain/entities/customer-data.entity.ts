import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';
import { CustomerSimilarityEdge } from './customer-similarity-edge.entity';
import { CustomerDataColdStart } from './customer-data-cold-start.entity';

@Entity('customer_data')
export class CustomerData {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'customer_name', type: 'text' })
  customerName!: string;

  @Column({ name: 'customer_name_normalized', type: 'text' })
  customerNameNormalized!: string;

  @Column({ name: 'customer_region', type: 'text' })
  customerRegion!: string;

  @Column({ name: 'org_type_primary', type: 'varchar', length: 64, nullable: true })
  orgTypePrimary?: string | null;

  @Column({ name: 'org_type_tags', type: 'text', array: true, default: '{}' })
  orgTypeTags!: string[];

  @Column({ name: 'name_embedding', type: 'float', array: true, nullable: true })
  nameEmbedding?: number[] | null;

  @Column({ name: 'name_variants', type: 'jsonb', default: {} })
  nameVariants!: Record<string, number>;

  @Column({ name: 'source_first_seen_at', type: 'timestamptz' })
  sourceFirstSeenAt!: Date;

  @Column({ name: 'source_last_seen_at', type: 'timestamptz' })
  sourceLastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Customer, (c) => c.customerData)
  customers!: Customer[];

  @OneToMany(() => Sale, (s) => s.customerData)
  sales!: Sale[];

  @OneToMany(() => CustomerSimilarityEdge, (e) => e.sourceCustomerData)
  similarityOut!: CustomerSimilarityEdge[];

  @OneToOne(() => CustomerDataColdStart, (c) => c.customerData)
  coldStart?: CustomerDataColdStart | null;
}
