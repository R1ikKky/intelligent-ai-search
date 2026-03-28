import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.provider';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class IndexingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexingService.name);
  private readonly index: string;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.index = this.configService.get<string>('elasticsearch.index') ?? 'products';
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureIndex();
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.esClient.indices.exists({ index: this.index });
    if (!exists) {
      await this.createIndex();
      this.logger.log(`Created Elasticsearch index: ${this.index}`);
    } else {
      this.logger.log(`Elasticsearch index already exists: ${this.index}`);
    }
  }

  private async createIndex(): Promise<void> {
    await this.esClient.indices.create({
      index: this.index,
      settings: {
        analysis: {
          analyzer: {
            russian_standard: { type: 'russian' },
          },
        },
      } as Record<string, unknown>,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          externalId: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'russian',
            fields: { keyword: { type: 'keyword' } },
          } as Record<string, unknown>,
          description: { type: 'text', analyzer: 'russian' } as Record<string, unknown>,
          category: {
            type: 'text',
            analyzer: 'russian',
            fields: { keyword: { type: 'keyword' } },
          } as Record<string, unknown>,
          unit: { type: 'keyword' },
          price: { type: 'float' },
          synonyms: { type: 'keyword' },
          embedding: { type: 'dense_vector', dims: 768, index: false } as Record<string, unknown>,
        },
      },
    });
  }

  async indexProduct(product: Product): Promise<void> {
    await this.esClient.index({
      index: this.index,
      id: product.id,
      document: {
        id: product.id,
        externalId: product.externalId,
        name: product.name,
        description: product.description,
        category: product.category,
        unit: product.unit,
        price: product.price ?? null,
        synonyms: product.synonyms,
        embedding: product.embedding ?? null,
      },
    });
  }

  async bulkIndex(products: Product[]): Promise<void> {
    if (!products.length) return;

    const operations = products.flatMap((p) => [
      { index: { _index: this.index, _id: p.id } },
      {
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        description: p.description,
        category: p.category,
        unit: p.unit,
        price: p.price ?? null,
        synonyms: p.synonyms,
        embedding: p.embedding ?? null,
      },
    ]);

    const response = await this.esClient.bulk({ operations, refresh: true });
    if (response.errors) {
      const errors = response.items.filter((i) => i.index?.error);
      this.logger.error(`Bulk index had ${errors.length} errors`);
    }
    this.logger.log(`Indexed ${products.length} products`);
  }

  async deleteIndex(): Promise<void> {
    const exists = await this.esClient.indices.exists({ index: this.index });
    if (exists) {
      await this.esClient.indices.delete({ index: this.index });
    }
  }

  async reindexAll(products: Product[]): Promise<{ indexed: number }> {
    await this.deleteIndex();
    await this.createIndex();
    await this.bulkIndex(products);
    return { indexed: products.length };
  }
}
