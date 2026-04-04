import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerDataColdStart } from '../../domain/entities/customer-data-cold-start.entity';
import { CustomerPreferenceProfile } from '../../domain/entities/customer-preference-profile.entity';
import { IndexingModule } from '../indexing/indexing.module';
import { ProfileService } from './profile.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerPreferenceProfile, CustomerDataColdStart, Customer]),
    IndexingModule,
  ],
  controllers: [RecommendationsController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
