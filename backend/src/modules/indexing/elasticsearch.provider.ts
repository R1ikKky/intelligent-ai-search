import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';

export const ElasticsearchProvider: Provider = {
  provide: ELASTICSEARCH_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Client => {
    return new Client({
      node: config.get<string>('elasticsearch.node') ?? 'http://localhost:9200',
    });
  },
};
