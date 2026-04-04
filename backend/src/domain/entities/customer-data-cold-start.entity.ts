import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerData } from './customer-data.entity';

/** Cold-start сигналы по организации (ИНН), заполняются ETL; копируются в customer_preference_profile при регистрации. */
@Entity('customer_data_cold_start')
export class CustomerDataColdStart {
  @PrimaryColumn({ name: 'customer_data_id', type: 'varchar', length: 12 })
  customerDataId!: string;

  @OneToOne(() => CustomerData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_data_id' })
  customerData!: CustomerData;

  @Column({ name: 'cold_start_seed_categories', type: 'jsonb', default: {} })
  coldStartSeedCategories!: Record<string, number>;

  @Column({ name: 'cold_start_seed_manufacturers', type: 'jsonb', default: {} })
  coldStartSeedManufacturers!: Record<string, number>;

  @Column({ name: 'cold_start_seed_suppliers', type: 'jsonb', default: {} })
  coldStartSeedSuppliers!: Record<string, number>;

  @Column({ name: 'seed_source', type: 'varchar', length: 64, default: 'similar_organizations' })
  seedSource!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
