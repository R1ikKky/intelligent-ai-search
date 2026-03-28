import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SynonymsService } from './synonyms.service';
import { SynonymsController } from './synonyms.controller';
import { IndexingModule } from '../indexing/indexing.module';
import { UserBehaviorModule } from '../user-behavior/user-behavior.module';

@Module({
  imports: [IndexingModule, UserBehaviorModule],
  controllers: [SynonymsController],
  providers: [SearchService, SynonymsService],
  exports: [SearchService],
})
export class SearchModule {}
