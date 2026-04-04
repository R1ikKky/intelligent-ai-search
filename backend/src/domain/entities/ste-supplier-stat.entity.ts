import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Ste } from './ste.entity';
import { Supplier } from './supplier.entity';

@Entity('ste_supplier_stat')
export class SteSupplierStat {
  @PrimaryColumn({ name: 'ste_id', type: 'varchar', length: 32 })
  steId!: string;

  @PrimaryColumn({ name: 'supplier_id', type: 'varchar', length: 12 })
  supplierId!: string;

  @ManyToOne(() => Ste, (s) => s.supplierStats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ste_id' })
  ste!: Ste;

  @ManyToOne(() => Supplier, (s) => s.steSupplierStats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ name: 'contracts_count', type: 'int' })
  contractsCount!: number;

  @Column({
    name: 'contracts_total_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  contractsTotalAmount!: string;

  @Column({ name: 'first_contract_at', type: 'timestamptz' })
  firstContractAt!: Date;

  @Column({ name: 'last_contract_at', type: 'timestamptz' })
  lastContractAt!: Date;

  @Column({ name: 'rank_in_ste', type: 'int' })
  rankInSte!: number;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;
}
