import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SuggestService } from './suggest.service';
import { SynonymsService } from './synonyms.service';
import { SynonymsController } from './synonyms.controller';
import { SearchController } from './search.controller';
import { IndexingModule } from '../indexing/indexing.module';
import { UserBehaviorModule } from '../user-behavior/user-behavior.module';

@Module({
  imports: [IndexingModule, UserBehaviorModule],
  controllers: [SynonymsController, SearchController],
  providers: [SearchService, SuggestService, SynonymsService],
  exports: [SearchService, SuggestService],
})
export class SearchModule {}
