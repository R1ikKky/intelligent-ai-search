import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { SteSupplierStat } from './ste-supplier-stat.entity';
import { Sale } from './sale.entity';

@Entity('ste')
export class Ste {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ name: 'attributes_raw', type: 'text', default: '' })
  attributesRaw!: string;

  @Column({ name: 'attributes_jsonb', type: 'jsonb', default: {} })
  attributesJsonb!: Record<string, string>;

  @Column({ name: 'manufacturer_name', type: 'text', nullable: true })
  manufacturerName?: string | null;

  @Column({ name: 'manufacturer_source', type: 'varchar', length: 32, default: 'unknown' })
  manufacturerSource!: string;

  @Column({ name: 'manufacturer_confidence', type: 'float', default: 0 })
  manufacturerConfidence!: number;

  @Column({ name: 'id_supplier', type: 'varchar', length: 12, nullable: true })
  idSupplier?: string | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_supplier' })
  primarySupplier?: Supplier | null;

  @Column({ name: 'supplier_resolution_method', type: 'varchar', length: 32, default: 'none' })
  supplierResolutionMethod!: string;

  @Column({ name: 'source_status', type: 'varchar', length: 32, default: 'catalog' })
  sourceStatus!: string;

  @Column({ name: 'search_text', type: 'text' })
  searchText!: string;

  /** Stored as float8[] until pgvector backfill; nullable */
  @Column({ type: 'float', array: true, nullable: true })
  embedding?: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SteSupplierStat, (s) => s.ste)
  supplierStats!: SteSupplierStat[];

  @OneToMany(() => Sale, (s) => s.ste)
  sales!: Sale[];
}
