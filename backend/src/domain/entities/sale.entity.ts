import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ste } from './ste.entity';
import { CustomerData } from './customer-data.entity';
import { Supplier } from './supplier.entity';

@Entity('sale')
export class Sale {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'contract_id', type: 'varchar', length: 64 })
  contractId!: string;

  @Column({ name: 'ste_id', type: 'varchar', length: 32 })
  steId!: string;

  @ManyToOne(() => Ste, (s) => s.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ste_id' })
  ste!: Ste;

  @Column({ name: 'customer_data_id', type: 'varchar', length: 12 })
  customerDataId!: string;

  @ManyToOne(() => CustomerData, (c) => c.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_data_id' })
  customerData!: CustomerData;

  @Column({ name: 'supplier_id', type: 'varchar', length: 12 })
  supplierId!: string;

  @ManyToOne(() => Supplier, (s) => s.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ name: 'procurement_title', type: 'text' })
  procurementTitle!: string;

  @Column({ name: 'contract_date', type: 'timestamptz' })
  contractDate!: Date;

  @Column({
    name: 'contract_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  contractAmount!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
