import { Module } from '@nestjs/common';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { IndexingService } from './indexing.service';
import { IndexingController } from './indexing.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  providers: [ElasticsearchProvider, IndexingService],
  controllers: [IndexingController],
  exports: [ElasticsearchProvider, IndexingService],
})
export class IndexingModule {}
