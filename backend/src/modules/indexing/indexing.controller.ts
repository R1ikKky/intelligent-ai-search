import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Product } from '../products/entities/product.entity';
import { Ste } from '../../domain/entities/ste.entity';
import { IndexingService } from './indexing.service';

@ApiTags('Indexing')
@ApiBearerAuth()
@Controller('indexing')
export class IndexingController {
  constructor(
    private readonly indexingService: IndexingService,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Ste)
    private readonly steRepo: Repository<Ste>,
  ) {}

  @Post('reindex')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Полная переиндексация: СТЕ из БД или каталог products' })
  async reindex(): Promise<{ indexed: number; source: 'ste' | 'products' }> {
    const nSte = await this.steRepo.count();
    if (nSte > 0) {
      const { indexed } = await this.indexingService.reindexAllFromSte();
      return { indexed, source: 'ste' };
    }
    const products = await this.productRepo.find();
    const { indexed } = await this.indexingService.reindexAll(products);
    return { indexed, source: 'products' };
  }
}
