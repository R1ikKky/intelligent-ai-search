import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerDataColdStart } from '../../domain/entities/customer-data-cold-start.entity';
import { CustomerPreferenceProfile } from '../../domain/entities/customer-preference-profile.entity';
import { ELASTICSEARCH_CLIENT } from '../indexing/elasticsearch.provider';
import { BootstrapResponseDto } from './dto/bootstrap-response.dto';
import { SearchResultItemDto } from '../products/dto/product.dto';

const EMPTY_JSON = '{}';

function emptyProfile(customerId: string): CustomerPreferenceProfile {
  const p = new CustomerPreferenceProfile();
  p.customerId = customerId;
  p.topCategories = {};
  p.topManufacturers = {};
  p.topSuppliers = {};
  p.topAttributes = {};
  p.coldStartSeedCategories = {};
  p.coldStartSeedManufacturers = {};
  p.coldStartSeedSuppliers = {};
  p.seedSource = 'similar_organizations';
  p.negativePatterns = {};
  p.queryEmbeddingCentroid = null;
  return p;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly index: string;

  constructor(
    @InjectRepository(CustomerPreferenceProfile)
    private readonly profileRepo: Repository<CustomerPreferenceProfile>,
    @InjectRepository(CustomerDataColdStart)
    private readonly orgColdRepo: Repository<CustomerDataColdStart>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @Inject(ELASTICSEARCH_CLIENT) private readonly esClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.index = this.configService.get<string>('elasticsearch.index') ?? 'products';
  }

  /** Копирует org-level cold-start из ETL в профиль пользователя (идемпотентно, если seeds пустые в профиле). */
  async syncColdStartFromOrg(customerId: string, customerDataId: string): Promise<void> {
    const org = await this.orgColdRepo.findOne({ where: { customerDataId } });
    if (!org) {
      this.logger.debug(`No customer_data_cold_start for org ${customerDataId}`);
      return;
    }
    const hasOrgSeeds =
      Object.keys(org.coldStartSeedCategories).length > 0 ||
      Object.keys(org.coldStartSeedManufacturers).length > 0 ||
      Object.keys(org.coldStartSeedSuppliers).length > 0;
    if (!hasOrgSeeds) return;

    let profile = await this.profileRepo.findOne({ where: { customerId } });
    if (!profile) {
      profile = emptyProfile(customerId);
    }
    const profileEmpty =
      Object.keys(profile.coldStartSeedCategories).length === 0 &&
      Object.keys(profile.coldStartSeedManufacturers).length === 0 &&
      Object.keys(profile.coldStartSeedSuppliers).length === 0;
    if (!profileEmpty) return;

    profile.coldStartSeedCategories = { ...org.coldStartSeedCategories };
    profile.coldStartSeedManufacturers = { ...org.coldStartSeedManufacturers };
    profile.coldStartSeedSuppliers = { ...org.coldStartSeedSuppliers };
    profile.seedSource = org.seedSource || 'similar_organizations';
    await this.profileRepo.save(profile);
  }

  async ensureProfile(customerId: string): Promise<CustomerPreferenceProfile> {
    let profile = await this.profileRepo.findOne({ where: { customerId } });
    if (!profile) {
      profile = emptyProfile(customerId);
      await this.profileRepo.save(profile);
    }
    return profile;
  }

  async bootstrap(user: JwtPayload): Promise<BootstrapResponseDto> {
    const customer = await this.customerRepo.findOne({ where: { id: user.userId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    await this.syncColdStartFromOrg(customer.id, customer.customerDataId);
    const profile = await this.ensureProfile(customer.id);
    const suggested = await this.suggestedFromEs(profile);

    return {
      customerId: customer.id,
      customerDataId: customer.customerDataId,
      seedSource: profile.seedSource,
      coldStartSeedCategories: profile.coldStartSeedCategories,
      coldStartSeedManufacturers: profile.coldStartSeedManufacturers,
      coldStartSeedSuppliers: profile.coldStartSeedSuppliers,
      suggestedProducts: suggested,
    };
  }

  /** Нормализованные веса категорий для лёгкого boost в поиске (0..1). */
  async getColdStartCategoryWeights(customerId: string): Promise<Map<string, number>> {
    const profile = await this.profileRepo.findOne({ where: { customerId } });
    if (!profile?.coldStartSeedCategories) return new Map();
    const entries = Object.entries(profile.coldStartSeedCategories).filter(([, v]) => v > 0);
    if (!entries.length) return new Map();
    const max = Math.max(...entries.map(([, v]) => v));
    const m = new Map<string, number>();
    for (const [k, v] of entries) {
      m.set(k, max > 0 ? v / max : 0);
    }
    return m;
  }

  private async suggestedFromEs(profile: CustomerPreferenceProfile): Promise<SearchResultItemDto[]> {
    const cats = Object.entries(profile.coldStartSeedCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c)
      .filter(Boolean);
    if (!cats.length) return [];

    const response = await this.esClient.search({
      index: this.index,
      size: 12,
      query: {
        bool: {
          should: cats.map((c) => ({ term: { 'category.keyword': c } })),
          minimum_should_match: 1,
        },
      },
    });

    const hits = response.hits?.hits ?? [];
    return hits.map((hit) => {
      const src = hit._source as Record<string, unknown>;
      const score = hit._score ?? 0;
      return {
        id: String(src.id ?? ''),
        externalId: String(src.externalId ?? src.id ?? ''),
        name: String(src.name ?? ''),
        description: String(src.description ?? ''),
        category: String(src.category ?? ''),
        unit: String(src.unit ?? 'шт'),
        price: typeof src.price === 'number' ? src.price : undefined,
        score: Math.round(score * 1000) / 1000,
        personalizedScore: Math.round(score * 1000) / 1000,
        isPersonalized: true,
      };
    });
  }
}
