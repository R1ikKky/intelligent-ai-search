import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ste } from '../../domain/entities/ste.entity';
import { Product } from '../products/entities/product.entity';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { IndexingService } from './indexing.service';
import { IndexingController } from './indexing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ste, Product])],
  controllers: [IndexingController],
  providers: [ElasticsearchProvider, IndexingService],
  exports: [ElasticsearchProvider, IndexingService],
})
export class IndexingModule {}
