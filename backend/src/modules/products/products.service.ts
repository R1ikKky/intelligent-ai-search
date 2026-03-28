import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { BulkImportDto } from './dto/bulk-import.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    return this.productRepo.findByIds(ids);
  }

  async bulkImport(dto: BulkImportDto): Promise<{ imported: number }> {
    const entities = dto.products.map((p) =>
      this.productRepo.create({
        externalId: p.externalId,
        name: p.name,
        description: p.description ?? '',
        category: p.category,
        unit: p.unit,
        price: p.price,
        synonyms: p.synonyms ?? [],
      }),
    );

    // Upsert by externalId
    await this.productRepo
      .createQueryBuilder()
      .insert()
      .into(Product)
      .values(entities)
      .orUpdate(['name', 'description', 'category', 'unit', 'price', 'synonyms'], ['external_id'])
      .execute();

    return { imported: entities.length };
  }

  async saveAll(products: Partial<Product>[]): Promise<Product[]> {
    return this.productRepo.save(products as Product[]);
  }

  async findAll(): Promise<Product[]> {
    return this.productRepo.find();
  }
}
