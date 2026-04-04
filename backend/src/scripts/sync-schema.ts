/**
 * One-shot: create/update DB schema (TypeORM synchronize). Used by Docker before ETL.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Product } from '../modules/products/entities/product.entity';
import { UserBehaviorEvent } from '../modules/user-behavior/entities/user-behavior-event.entity';
import { UserProductScore } from '../modules/user-behavior/entities/user-product-score.entity';
import {
  Customer,
  CustomerData,
  CustomerDataColdStart,
  CustomerPreferenceProfile,
  CustomerSimilarityEdge,
  EtlQualityLog,
  Sale,
  Ste,
  SteSupplierStat,
  Supplier,
} from '../domain/entities';

async function main(): Promise<void> {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT ?? '5432', 10);
  const username = process.env.POSTGRES_USER ?? 'search_user';
  const password = process.env.POSTGRES_PASSWORD ?? 'search_pass';
  const database = process.env.POSTGRES_DB ?? 'search_db';

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: [
      Product,
      UserBehaviorEvent,
      UserProductScore,
      CustomerData,
      Customer,
      Supplier,
      Ste,
      SteSupplierStat,
      Sale,
      CustomerSimilarityEdge,
      EtlQualityLog,
      CustomerDataColdStart,
      CustomerPreferenceProfile,
    ],
    synchronize: true,
    logging: false,
  });

  await ds.initialize();
  console.log('Schema synchronized OK');
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
