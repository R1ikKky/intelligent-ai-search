import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IndexingService } from './indexing.service';
import { ProductsService } from '../products/products.service';

@ApiTags('Indexing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('indexing')
export class IndexingController {
  constructor(
    private readonly indexingService: IndexingService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('reindex')
  @ApiOperation({ summary: 'Full reindex from PostgreSQL to Elasticsearch' })
  @ApiResponse({ status: 201, schema: { example: { indexed: 500 } } })
  async reindex(): Promise<{ indexed: number }> {
    const products = await this.productsService.findAll();
    return this.indexingService.reindexAll(products);
  }

  @Post('product/:id')
  @ApiOperation({ summary: 'Reindex single product by UUID' })
  @ApiResponse({ status: 201, schema: { example: { ok: true } } })
  async reindexOne(@Param('id') id: string): Promise<{ ok: boolean }> {
    const product = await this.productsService.findById(id);
    await this.indexingService.indexProduct(product);
    return { ok: true };
  }
}
