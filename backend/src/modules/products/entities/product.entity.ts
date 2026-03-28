import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'external_id' })
  externalId!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Index()
  @Column()
  category!: string;

  @Column()
  unit!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'jsonb', default: [] })
  synonyms!: string[];

  @Column({ type: 'jsonb', nullable: true })
  embedding?: number[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
