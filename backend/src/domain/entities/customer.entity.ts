import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerData } from './customer-data.entity';
import { CustomerPreferenceProfile } from './customer-preference-profile.entity';

@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_data_id', type: 'varchar', length: 12 })
  customerDataId!: string;

  @ManyToOne(() => CustomerData, (d) => d.customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_data_id' })
  customerData!: CustomerData;

  @Column({ type: 'varchar', length: 12, unique: true })
  login!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @OneToOne(() => CustomerPreferenceProfile, (p) => p.customer)
  preferenceProfile?: CustomerPreferenceProfile | null;
}
