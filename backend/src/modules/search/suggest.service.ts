import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { ELASTICSEARCH_CLIENT } from '../indexing/elasticsearch.provider';
import { SuggestItemDto, SuggestQueryDto, SuggestResponseDto } from './dto/suggest.dto';
import { SynonymsService } from './synonyms.service';

@Injectable()
export class SuggestService {
  private readonly index: string;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
    private readonly configService: ConfigService,
    private readonly synonymsService: SynonymsService,
  ) {
    this.index = this.configService.get<string>('elasticsearch.index') ?? 'products';
  }

  async suggest(dto: SuggestQueryDto): Promise<SuggestResponseDto> {
    const { query, limit = 10 } = dto;
    const items: SuggestItemDto[] = [];

    // 1. Prefix / completion suggestions from ES
    const esResponse = await this.esClient.search({
      index: this.index,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['name^3', 'description', 'synonyms^2'],
          fuzziness: 'AUTO',
          analyzer: 'russian',
          type: 'best_fields',
        },
      },
      _source: ['name'],
    });

    const seen = new Set<string>();
    const prefix = query.toLowerCase().slice(0, 4);

    for (const hit of esResponse.hits.hits) {
      const src = hit._source as { name: string } | undefined;
      if (!src) continue;
      const text = src.name;
      if (seen.has(text)) continue;
      seen.add(text);

      const isTypo = !text.toLowerCase().startsWith(prefix);
      items.push({ text, kind: isTypo ? 'spellfix' : 'popular' });
    }

    // 2. Synonym expansion
    const synonymLines = this.synonymsService.getSynonymLines();
    for (const line of synonymLines) {
      const terms = line.split(',').map((t) => t.trim());
      const matched = terms.find((t) => t.toLowerCase().includes(prefix));
      if (!matched) continue;
      for (const alt of terms) {
        if (alt === matched || seen.has(alt)) continue;
        seen.add(alt);
        items.push({ text: alt, kind: 'synonym' });
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }

    return { normalized_query: query, items };
  }
}
