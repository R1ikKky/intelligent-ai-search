import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('etl_quality_log')
export class EtlQualityLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @Column({ name: 'source_name', type: 'text' })
  sourceName!: string;

  @Column({ name: 'entity_name', type: 'text' })
  entityName!: string;

  @Column({ name: 'entity_key', type: 'text' })
  entityKey!: string;

  @Column({ name: 'issue_code', type: 'text' })
  issueCode!: string;

  @Column({ name: 'issue_payload', type: 'jsonb', nullable: true })
  issuePayload?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
