import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from '../indexing/elasticsearch.provider';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check for all services' })
  @ApiResponse({ status: 200 })
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres'),
      async () => {
        try {
          await this.esClient.ping();
          return { elasticsearch: { status: 'up' } };
        } catch {
          return { elasticsearch: { status: 'down' } };
        }
      },
    ]);
  }
}
