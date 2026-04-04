import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.provider';
import { Product } from '../products/entities/product.entity';
import { Ste } from '../../domain/entities/ste.entity';

export interface SearchableProductDoc {
  id: string;
  externalId: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number | null;
  synonyms: string[];
  embedding?: number[] | null;
}

@Injectable()
export class IndexingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexingService.name);
  private readonly index: string;
  private readonly autoReindexOnStart: boolean;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
    private readonly configService: ConfigService,
    @InjectRepository(Ste)
    private readonly steRepo: Repository<Ste>,
  ) {
    this.index = this.configService.get<string>('elasticsearch.index') ?? 'products';
    this.autoReindexOnStart =
      this.configService.get<boolean>('elasticsearch.autoReindexOnStart') ?? false;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureIndex();
    if (this.autoReindexOnStart) {
      const n = await this.steRepo.count();
      if (n > 0) {
        this.logger.log(`AUTO_REINDEX_ON_START: indexing ${n} STE rows`);
        await this.reindexAllFromSte();
      } else {
        this.logger.warn('AUTO_REINDEX_ON_START: ste table empty, skip');
      }
    }
  }

  async steCountForReindex(): Promise<number> {
    return this.steRepo.count();
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
          embedding: { type: 'dense_vector', dims: 384, index: false } as Record<string, unknown>,
        },
      },
    });
  }

  steToDoc(ste: Ste): SearchableProductDoc {
    return {
      id: ste.id,
      externalId: ste.id,
      name: ste.name,
      description: ste.searchText || `${ste.name} ${ste.category} ${ste.attributesRaw}`,
      category: ste.category,
      unit: 'шт',
      price: null,
      synonyms: [],
      embedding: ste.embedding?.length === 384 ? ste.embedding : null,
    };
  }
  async indexProduct(product: Product): Promise<void> {
    const doc: SearchableProductDoc = {
      id: product.id,
      externalId: product.externalId,
      name: product.name,
      description: product.description ?? '',
      category: product.category,
      unit: product.unit,
      price: product.price ?? null,
      synonyms: product.synonyms,
      embedding: product.embedding?.length === 384 ? (product.embedding as number[]) : null,
    };
    await this.esClient.index({
      index: this.index,
      id: doc.id,
      document: doc,
    });
  }

  async bulkIndex(products: Product[]): Promise<void> {
    if (!products.length) return;
    const operations = products.flatMap((p) => {
      const doc: SearchableProductDoc = {
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        description: p.description ?? '',
        category: p.category,
        unit: p.unit,
        price: p.price ?? null,
        synonyms: p.synonyms,
        embedding: p.embedding?.length === 384 ? (p.embedding as number[]) : null,
      };
      return [{ index: { _index: this.index, _id: p.id } }, doc];
    });
    const response = await this.esClient.bulk({ operations, refresh: true });
    if (response.errors) {
      const errors = response.items.filter((i) => i.index?.error);
      this.logger.error(`Bulk index had ${errors.length} errors`);
    }
    this.logger.log(`Indexed ${products.length} products`);
  }

  async bulkIndexSte(stes: Ste[]): Promise<void> {
    if (!stes.length) return;
    const operations = stes.flatMap((s) => {
      const doc = this.steToDoc(s);
      return [{ index: { _index: this.index, _id: s.id } }, doc];
    });
    const response = await this.esClient.bulk({ operations, refresh: true });
    if (response.errors) {
      const errors = response.items.filter((i) => i.index?.error);
      this.logger.error(`Bulk STE index had ${errors.length} errors`);
    }
    this.logger.log(`Indexed ${stes.length} STE documents`);
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

  async reindexAllFromSte(batchSize = 2000): Promise<{ indexed: number }> {
    await this.deleteIndex();
    await this.createIndex();
    let total = 0;
    let offset = 0;
    for (;;) {
      const batch = await this.steRepo.find({
        order: { id: 'ASC' },
        take: batchSize,
        skip: offset,
      });
      if (!batch.length) break;
      await this.bulkIndexSte(batch);
      total += batch.length;
      offset += batchSize;
    }
    return { indexed: total };
  }
}