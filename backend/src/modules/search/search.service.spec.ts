import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { UserBehaviorService } from '../user-behavior/user-behavior.service';
import { ELASTICSEARCH_CLIENT } from '../indexing/elasticsearch.provider';
import { ProfileService } from '../profile/profile.service';
import { SearchQueryDto } from '../products/dto/search-query.dto';

const mockEsResponse = {
  hits: {
    total: { value: 2 },
    hits: [
      {
        _id: 'id-1',
        _score: 1.5,
        _source: { id: 'id-1', externalId: 'STE-001', name: 'Бумага А4', description: 'Офисная бумага', category: 'Офисные принадлежности', unit: 'пачка', price: 450, synonyms: [] },
      },
      {
        _id: 'id-2',
        _score: 1.0,
        _source: { id: 'id-2', externalId: 'STE-002', name: 'Бумага А3', description: 'Большой лист', category: 'Офисные принадлежности', unit: 'пачка', price: 600, synonyms: [] },
      },
    ],
  },
  suggest: {},
};

describe('SearchService', () => {
  let service: SearchService;
  let esClient: { search: jest.Mock };
  let behaviorService: {
    getScoreMap: jest.Mock;
    getCategoryOrderCounts: jest.Mock;
  };

  beforeEach(async () => {
    esClient = { search: jest.fn().mockResolvedValue(mockEsResponse) };
    behaviorService = {
      getScoreMap: jest.fn().mockResolvedValue(new Map()),
      getCategoryOrderCounts: jest.fn().mockResolvedValue(new Map()),
    };
    const profileService = {
      getColdStartCategoryWeights: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ELASTICSEARCH_CLIENT, useValue: esClient },
        { provide: UserBehaviorService, useValue: behaviorService },
        { provide: ProfileService, useValue: profileService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const cfg: Record<string, unknown> = {
                'elasticsearch.index': 'products',
                'personalization.maxScore': 100,
                'personalization.boostMax': 2.0,
              };
              return cfg[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return search results without personalization', async () => {
    const query: SearchQueryDto = { q: 'бумага', page: 1, limit: 20 };
    const result = await service.search(query);

    expect(esClient.search).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.items[0].name).toBe('Бумага А4');
    expect(result.items[0].isPersonalized).toBe(false);
  });

  it('should apply personalization boost when userId provided', async () => {
    behaviorService.getScoreMap.mockResolvedValue(new Map([['id-1', 50]]));
    behaviorService.getCategoryOrderCounts.mockResolvedValue(new Map());

    const query: SearchQueryDto = { q: 'бумага', userId: 'user-1', page: 1, limit: 20 };
    const result = await service.search(query);

    const item1 = result.items.find((i) => i.id === 'id-1');
    const item2 = result.items.find((i) => i.id === 'id-2');

    // id-1 has score 50/100 * 2.0 = 1.0 boost => personalizedScore = 1.5 * (1 + 1.0) = 3.0
    expect(item1?.isPersonalized).toBe(true);
    expect(item1?.personalizedScore).toBeCloseTo(3.0, 2);

    // id-2 has no score => personalizedScore == esScore
    expect(item2?.isPersonalized).toBe(false);
    expect(item2?.personalizedScore).toBeCloseTo(1.0, 2);
  });

  it('should apply category boost when user ordered category > 3 times', async () => {
    behaviorService.getScoreMap.mockResolvedValue(new Map());
    behaviorService.getCategoryOrderCounts.mockResolvedValue(
      new Map([['Офисные принадлежности', 5]]),
    );

    const query: SearchQueryDto = { q: 'бумага', userId: 'user-1', page: 1, limit: 20 };
    const result = await service.search(query);

    // category count > 3, so +0.3 boost: score * (1 + 0.3)
    expect(result.items[0].personalizedScore).toBeCloseTo(1.5 * 1.3, 2);
    expect(result.items[0].isPersonalized).toBe(true);
  });

  it('should cap personalization boost at BOOST_MAX', async () => {
    behaviorService.getScoreMap.mockResolvedValue(new Map([['id-1', 999]]));
    behaviorService.getCategoryOrderCounts.mockResolvedValue(new Map());

    const query: SearchQueryDto = { q: 'бумага', userId: 'user-1', page: 1, limit: 20 };
    const result = await service.search(query);

    const item1 = result.items.find((i) => i.id === 'id-1');
    // boost capped at 2.0 => personalizedScore = 1.5 * (1 + 2.0) = 4.5
    expect(item1?.personalizedScore).toBeCloseTo(4.5, 2);
  });

  it('should return null suggestion when no suggestion found', async () => {
    const query: SearchQueryDto = { q: 'бумага', page: 1, limit: 20 };
    const result = await service.search(query);
    expect(result.suggestion).toBeNull();
  });

  it('should return pagination defaults', async () => {
    const query: SearchQueryDto = { q: 'тест', page: 2, limit: 10 };
    await service.search(query);

    const callArg = esClient.search.mock.calls[0][0] as { from: number; size: number };
    expect(callArg.from).toBe(10); // (2-1)*10
    expect(callArg.size).toBe(10);
  });
});
