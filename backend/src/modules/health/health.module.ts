import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { IndexingModule } from '../indexing/indexing.module';

@Module({
  imports: [TerminusModule, IndexingModule],
  controllers: [HealthController],
})
export class HealthModule {}
