import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { SteSupplierStat } from './ste-supplier-stat.entity';

@Entity('supplier')
export class Supplier {
  @PrimaryColumn({ type: 'varchar', length: 12 })
  id!: string;

  @Column({ name: 'supplier_name', type: 'text' })
  supplierName!: string;

  @Column({ name: 'supplier_region', type: 'text' })
  supplierRegion!: string;

  @Column({ name: 'name_variants', type: 'jsonb', default: {} })
  nameVariants!: Record<string, number>;

  @Column({ name: 'region_variants', type: 'jsonb', default: {} })
  regionVariants!: Record<string, number>;

  @Column({ name: 'source_first_seen_at', type: 'timestamptz' })
  sourceFirstSeenAt!: Date;

  @Column({ name: 'source_last_seen_at', type: 'timestamptz' })
  sourceLastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Sale, (s) => s.supplier)
  sales!: Sale[];

  @OneToMany(() => SteSupplierStat, (s) => s.supplier)
  steSupplierStats!: SteSupplierStat[];
}
