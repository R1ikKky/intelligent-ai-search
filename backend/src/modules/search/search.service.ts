import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import type { SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import { ELASTICSEARCH_CLIENT } from '../indexing/elasticsearch.provider';
import { UserBehaviorService } from '../user-behavior/user-behavior.service';
import { SearchQueryDto } from '../products/dto/search-query.dto';
import { SearchResponseDto, SearchResultItemDto } from '../products/dto/product.dto';

interface ProductDoc {
  id: string;
  externalId: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  price?: number;
  synonyms: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly index: string;
  private readonly maxScore: number;
  private readonly boostMax: number;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
    private readonly configService: ConfigService,
    private readonly behaviorService: UserBehaviorService,
  ) {
    this.index = this.configService.get<string>('elasticsearch.index') ?? 'products';
    this.maxScore = this.configService.get<number>('personalization.maxScore') ?? 100;
    this.boostMax = this.configService.get<number>('personalization.boostMax') ?? 2.0;
  }

  async search(query: SearchQueryDto): Promise<SearchResponseDto> {
    const { q, userId, page = 1, limit = 20, category } = query;
    const from = (page - 1) * limit;

    const response = await this.esClient.search<ProductDoc>({
      index: this.index,
      from,
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ['name^3', 'description^1', 'synonyms^2'],
                fuzziness: 'AUTO',
                analyzer: 'russian',
                type: 'best_fields',
              },
            },
            ...(category ? [{ term: { 'category.keyword': category } }] : []),
          ],
        },
      },
      suggest: {
        text: q,
        phrase_suggester: {
          phrase: {
            field: 'name',
            size: 1,
            gram_size: 3,
            direct_generator: [
              { field: 'name', suggest_mode: 'missing', min_word_length: 3 },
            ],
            highlight: { pre_tag: '<em>', post_tag: '</em>' },
          },
        },
      },
    });

    const hits = response.hits?.hits ?? [];
    const total =
      typeof response.hits?.total === 'object'
        ? response.hits.total.value
        : (response.hits?.total ?? 0);

    const suggestion = this.extractSuggestion(response, q);

    let items: SearchResultItemDto[];
    if (userId) {
      items = await this.applyPersonalization(hits, userId);
      items.sort((a, b) => b.personalizedScore - a.personalizedScore);
    } else {
      items = hits.map((hit) =>
        this.hitToDto(hit._source!, hit._score ?? 0, hit._score ?? 0, false),
      );
    }

    return { items, total, page, limit, suggestion };
  }

  private extractSuggestion(
    response: SearchResponse<ProductDoc>,
    originalQuery: string,
  ): string | null {
    try {
      const suggest = response.suggest as Record<
        string,
        Array<{ options: Array<{ text: string }> }>
      > | undefined;
      if (!suggest?.phrase_suggester) return null;
      for (const entry of suggest.phrase_suggester) {
        if (entry.options?.length > 0) {
          const suggested = entry.options[0].text;
          if (suggested.toLowerCase() !== originalQuery.toLowerCase()) {
            return suggested;
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  private async applyPersonalization(
    hits: SearchResponse<ProductDoc>['hits']['hits'],
    userId: string,
  ): Promise<SearchResultItemDto[]> {
    const productIds = hits.map((h) => h._source!.id);
    const [scoreMap, categoryBoosts] = await Promise.all([
      this.behaviorService.getScoreMap(userId, productIds),
      this.behaviorService.getCategoryOrderCounts(userId),
    ]);

    return hits.map((hit) => {
      const src = hit._source!;
      const esScore = hit._score ?? 0;
      const userScore = scoreMap.get(src.id) ?? 0;
      const personalizationBoost = Math.min(
        (userScore / this.maxScore) * this.boostMax,
        this.boostMax,
      );
      const categoryOrders = categoryBoosts.get(src.category) ?? 0;
      const catBoost = categoryOrders > 3 ? 0.3 : 0;
      const personalizedScore = esScore * (1 + personalizationBoost + catBoost);
      const isPersonalized = userScore > 0 || categoryOrders > 3;

      return this.hitToDto(src, esScore, personalizedScore, isPersonalized);
    });
  }

  private hitToDto(
    src: ProductDoc,
    score: number,
    personalizedScore: number,
    isPersonalized: boolean,
  ): SearchResultItemDto {
    return {
      id: src.id,
      externalId: src.externalId,
      name: src.name,
      description: src.description,
      category: src.category,
      unit: src.unit,
      price: src.price,
      score: Math.round(score * 1000) / 1000,
      personalizedScore: Math.round(personalizedScore * 1000) / 1000,
      isPersonalized,
    };
  }
}
