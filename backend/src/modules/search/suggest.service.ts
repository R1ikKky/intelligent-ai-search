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
    const { query, limit = 10, include_spellfix = true, include_synonyms = true } = dto;
    const items: SuggestItemDto[] = [];

    // 1. Prefix / completion suggestions from ES
    const esResponse = await this.esClient.search({
      index: this.index,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['name^3', 'description', 'synonyms^2'],
          fuzziness: include_spellfix ? 'AUTO' : '0',
          analyzer: 'russian',
          type: 'best_fields',
        },
      },
      _source: ['name'],
      highlight: {
        fields: { name: {} },
        pre_tags: [''],
        post_tags: [''],
      },
    });

    const seen = new Set<string>();

    for (const hit of esResponse.hits.hits) {
      const src = hit._source as { name: string } | undefined;
      if (!src) continue;
      const text = src.name;
      if (seen.has(text)) continue;
      seen.add(text);

      const isTypo =
        include_spellfix &&
        !text.toLowerCase().startsWith(query.toLowerCase().substring(0, 4));

      items.push({
        text,
        kind: isTypo ? 'spellfix' : 'popular',
        flags: isTypo
          ? ['TYPO_CORRECTION', 'CAN_REPLACE_QUERY']
          : ['POPULAR_MATCH'],
        score: Math.round((hit._score ?? 0) * 100) / 100,
      });
    }

    // 2. Synonym expansion hints
    if (include_synonyms) {
      const synonymLines = this.synonymsService.getSynonymLines();
      for (const line of synonymLines) {
        const terms = line.split(',').map((t) => t.trim());
        const matched = terms.find((t) =>
          t.toLowerCase().includes(query.toLowerCase().slice(0, 4)),
        );
        if (!matched) continue;
        for (const alt of terms) {
          if (alt === matched || seen.has(alt)) continue;
          seen.add(alt);
          items.push({
            text: alt,
            kind: 'synonym',
            flags: ['SYNONYM_EXPANSION'],
            score: 0.7,
          });
          if (items.length >= limit) break;
        }
        if (items.length >= limit) break;
      }
    }

    return { query, items: items.slice(0, limit) };
  }
}
