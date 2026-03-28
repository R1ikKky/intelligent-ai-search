import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { SearchModule } from './modules/search/search.module';
import { UserBehaviorModule } from './modules/user-behavior/user-behavior.module';
import { IndexingModule } from './modules/indexing/indexing.module';
import { HealthModule } from './modules/health/health.module';
import { Product } from './modules/products/entities/product.entity';
import { UserBehaviorEvent } from './modules/user-behavior/entities/user-behavior-event.entity';
import { UserProductScore } from './modules/user-behavior/entities/user-product-score.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('postgres.host'),
        port: config.get('postgres.port'),
        username: config.get('postgres.user'),
        password: config.get('postgres.password'),
        database: config.get('postgres.database'),
        entities: [Product, UserBehaviorEvent, UserProductScore],
        synchronize: config.get('nodeEnv') !== 'production',
        logging: config.get('nodeEnv') === 'development',
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
        },
      }),
    }),

    AuthModule,
    ProductsModule,
    SearchModule,
    UserBehaviorModule,
    IndexingModule,
    HealthModule,
  ],
})
export class AppModule {}
