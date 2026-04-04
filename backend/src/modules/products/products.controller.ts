import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BulkImportDto } from './dto/bulk-import.dto';
import { ProductDto, SearchResponseDto } from './dto/product.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from '../search/search.service';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly searchService: SearchService,
    private readonly productsService: ProductsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Personalized product search' })
  @ApiResponse({ status: 200, type: SearchResponseDto })
  async search(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SearchResponseDto> {
    return this.searchService.search(query, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by UUID' })
  @ApiResponse({ status: 200, type: ProductDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    const product = await this.productsService.findById(id);
    return {
      id: product.id,
      externalId: product.externalId,
      name: product.name,
      description: product.description,
      category: product.category,
      unit: product.unit,
      price: product.price,
      synonyms: product.synonyms,
    };
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import products from JSON' })
  @ApiResponse({ status: 201, schema: { example: { imported: 100 } } })
  async bulkImport(@Body() dto: BulkImportDto): Promise<{ imported: number }> {
    return this.productsService.bulkImport(dto);
  }
}
