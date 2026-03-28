import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import { Product } from '../modules/products/entities/product.entity';
import { UserBehaviorEvent, EventType, EVENT_WEIGHTS } from '../modules/user-behavior/entities/user-behavior-event.entity';
import { UserProductScore } from '../modules/user-behavior/entities/user-product-score.entity';

const CATEGORIES = [
  'Офисные принадлежности',
  'Инструменты',
  'Строительные материалы',
  'Электрооборудование',
  'Мебель',
  'Компьютерная техника',
  'Канцелярские товары',
  'Хозяйственные товары',
  'Медицинские принадлежности',
  'Уборочный инвентарь',
];

const PRODUCTS_DATA: Array<{ name: string; description: string; category: string; unit: string; price: number; synonyms: string[] }> = [
  // Офисные принадлежности
  { name: 'Бумага офисная А4 80г/м2 500л', description: 'Бумага офисная белая для принтеров и копиров', category: 'Офисные принадлежности', unit: 'пачка', price: 450, synonyms: ['бумага', 'paper', 'листы', 'А4'] },
  { name: 'Бумага А4 500 листов 75г/м2', description: 'Белая бумага формата А4', category: 'Офисные принадлежности', unit: 'пачка', price: 380, synonyms: ['бумага', 'А4'] },
  { name: 'Скоросшиватель пластиковый', description: 'Скоросшиватель для документов пластиковый А4', category: 'Офисные принадлежности', unit: 'шт', price: 25, synonyms: ['скоросшиватель', 'папка'] },
  { name: 'Папка-регистратор А4 75мм', description: 'Папка с арочным механизмом для документов', category: 'Офисные принадлежности', unit: 'шт', price: 180, synonyms: ['папка', 'регистратор', 'архивная папка'] },
  { name: 'Конверт С4 229х324 белый', description: 'Почтовый конверт формата С4', category: 'Офисные принадлежности', unit: 'шт', price: 12, synonyms: ['конверт', 'envelope'] },
  // Инструменты
  { name: 'Дрель ударная 800Вт', description: 'Электрическая ударная дрель мощностью 800Вт', category: 'Инструменты', unit: 'шт', price: 4500, synonyms: ['дрель', 'drill', 'перфоратор'] },
  { name: 'Шуруповёрт аккумуляторный 18В', description: 'Беспроводной шуруповёрт с Li-Ion батареей', category: 'Инструменты', unit: 'шт', price: 6800, synonyms: ['шуруповёрт', 'электроинструмент'] },
  { name: 'Молоток слесарный 500г', description: 'Стальной молоток с деревянной ручкой', category: 'Инструменты', unit: 'шт', price: 350, synonyms: ['молоток', 'hammer'] },
  { name: 'Отвёртка крестовая PH2 150мм', description: 'Ручная отвёртка крестовая', category: 'Инструменты', unit: 'шт', price: 120, synonyms: ['отвёртка', 'отвертка', 'screwdriver'] },
  { name: 'Плоскогубцы 200мм', description: 'Слесарные плоскогубцы комбинированные', category: 'Инструменты', unit: 'шт', price: 280, synonyms: ['плоскогубцы', 'пассатижи'] },
  // Строительные материалы
  { name: 'Цемент М400 50кг', description: 'Портландцемент марки М400', category: 'Строительные материалы', unit: 'мешок', price: 380, synonyms: ['цемент', 'cement', 'строительная смесь'] },
  { name: 'Кирпич красный рядовой М150', description: 'Одинарный полнотелый кирпич', category: 'Строительные материалы', unit: 'шт', price: 18, synonyms: ['кирпич', 'brick'] },
  { name: 'Краска водоэмульсионная 10л белая', description: 'Интерьерная матовая краска для стен', category: 'Строительные материалы', unit: 'ведро', price: 1200, synonyms: ['краска', 'paint', 'водоэмульсионка'] },
  { name: 'Шпатлёвка финишная 20кг', description: 'Сухая строительная смесь для финишной отделки', category: 'Строительные материалы', unit: 'мешок', price: 650, synonyms: ['шпатлёвка', 'шпаклёвка'] },
  { name: 'Гипсокартон 2500x1200x12,5мм', description: 'Стандартный гипсокартонный лист', category: 'Строительные материалы', unit: 'лист', price: 520, synonyms: ['гипсокартон', 'ГКЛ', 'гипрок'] },
  // Электрооборудование
  { name: 'Лампа LED E27 10Вт 4000K', description: 'Светодиодная лампа нейтральный белый свет', category: 'Электрооборудование', unit: 'шт', price: 85, synonyms: ['лампа', 'LED', 'светодиодная лампа', 'лампочка'] },
  { name: 'Удлинитель 5м 4 розетки', description: 'Электрический удлинитель с заземлением', category: 'Электрооборудование', unit: 'шт', price: 450, synonyms: ['удлинитель', 'переноска', 'сетевой фильтр'] },
  { name: 'Выключатель одноклавишный', description: 'Настенный выключатель освещения', category: 'Электрооборудование', unit: 'шт', price: 95, synonyms: ['выключатель', 'switch'] },
  { name: 'Кабель ВВГнг 2x1,5мм 100м', description: 'Силовой кабель негорючий', category: 'Электрооборудование', unit: 'бухта', price: 2800, synonyms: ['кабель', 'провод', 'cable'] },
  { name: 'Автомат защиты 16А однополюсный', description: 'Автоматический выключатель', category: 'Электрооборудование', unit: 'шт', price: 320, synonyms: ['автомат', 'автоматический выключатель', 'АВ'] },
  // Мебель
  { name: 'Стул офисный на колёсах', description: 'Офисное кресло с регулировкой высоты', category: 'Мебель', unit: 'шт', price: 5500, synonyms: ['стул', 'кресло', 'офисное кресло', 'chair'] },
  { name: 'Стол письменный 140x70см', description: 'Письменный стол для офиса', category: 'Мебель', unit: 'шт', price: 8900, synonyms: ['стол', 'desk', 'письменный стол'] },
  { name: 'Шкаф для документов металлический', description: 'Стальной архивный шкаф с замком', category: 'Мебель', unit: 'шт', price: 12000, synonyms: ['шкаф', 'сейф для документов', 'cabinet'] },
  { name: 'Тумба приставная', description: 'Офисная тумба под стол 3 ящика', category: 'Мебель', unit: 'шт', price: 4200, synonyms: ['тумба', 'тумбочка', 'pedestal'] },
  // Компьютерная техника
  { name: 'Мышь оптическая USB', description: 'Компьютерная мышь проводная', category: 'Компьютерная техника', unit: 'шт', price: 380, synonyms: ['мышь', 'mouse', 'мышка'] },
  { name: 'Клавиатура USB мембранная', description: 'Стандартная компьютерная клавиатура', category: 'Компьютерная техника', unit: 'шт', price: 650, synonyms: ['клавиатура', 'keyboard'] },
  { name: 'Монитор 22 дюйма Full HD', description: 'LED монитор 1920x1080 22 дюйма', category: 'Компьютерная техника', unit: 'шт', price: 12500, synonyms: ['монитор', 'monitor', 'дисплей'] },
  { name: 'Флеш-накопитель USB 32GB', description: 'USB Flash Drive 32 гигабайта', category: 'Компьютерная техника', unit: 'шт', price: 450, synonyms: ['флешка', 'USB флеш', 'накопитель'] },
  // Канцелярские товары
  { name: 'Ручка шариковая синяя 0,5мм', description: 'Шариковая ручка для письма', category: 'Канцелярские товары', unit: 'шт', price: 15, synonyms: ['ручка', 'pen', 'шариковая ручка'] },
  { name: 'Карандаш простой НВ', description: 'Графитовый карандаш средней твёрдости', category: 'Канцелярские товары', unit: 'шт', price: 12, synonyms: ['карандаш', 'pencil'] },
  { name: 'Маркер перманентный чёрный', description: 'Перманентный маркер для любых поверхностей', category: 'Канцелярские товары', unit: 'шт', price: 55, synonyms: ['маркер', 'marker'] },
  { name: 'Степлер 24/6 до 20 листов', description: 'Настольный степлер', category: 'Канцелярские товары', unit: 'шт', price: 180, synonyms: ['степлер', 'stapler'] },
  { name: 'Скобы для степлера 24/6 1000шт', description: 'Упаковка скоб для степлера', category: 'Канцелярские товары', unit: 'уп', price: 45, synonyms: ['скобы', 'staples'] },
  { name: 'Ножницы 210мм', description: 'Офисные ножницы нержавеющие', category: 'Канцелярские товары', unit: 'шт', price: 95, synonyms: ['ножницы', 'scissors'] },
  // Хозяйственные товары
  { name: 'Мешки для мусора 120л 10шт', description: 'Полиэтиленовые мусорные пакеты', category: 'Хозяйственные товары', unit: 'упаковка', price: 85, synonyms: ['мешки', 'пакеты', 'мусорные мешки'] },
  { name: 'Перчатки резиновые L', description: 'Резиновые хозяйственные перчатки', category: 'Хозяйственные товары', unit: 'пара', price: 45, synonyms: ['перчатки', 'gloves'] },
  { name: 'Моющее средство для посуды 500мл', description: 'Жидкость для мытья посуды', category: 'Хозяйственные товары', unit: 'шт', price: 120, synonyms: ['моющее', 'dishwashing', 'средство для мытья'] },
  // Медицинские принадлежности
  { name: 'Аптечка первой помощи', description: 'Стандартная аптечка для организаций', category: 'Медицинские принадлежности', unit: 'комплект', price: 850, synonyms: ['аптечка', 'first aid kit'] },
  { name: 'Маска медицинская трёхслойная', description: 'Одноразовая медицинская маска', category: 'Медицинские принадлежности', unit: 'шт', price: 8, synonyms: ['маска', 'mask', 'медицинская маска'] },
  { name: 'Антисептик для рук 250мл', description: 'Спиртовой антисептик для дезинфекции', category: 'Медицинские принадлежности', unit: 'шт', price: 180, synonyms: ['антисептик', 'дезинфектор', 'санитайзер'] },
  // Уборочный инвентарь
  { name: 'Швабра с отжимом телескопическая', description: 'Швабра с ведром и механизмом отжима', category: 'Уборочный инвентарь', unit: 'шт', price: 1200, synonyms: ['швабра', 'mop', 'уборка'] },
  { name: 'Ведро пластиковое 10л', description: 'Хозяйственное ведро для уборки', category: 'Уборочный инвентарь', unit: 'шт', price: 95, synonyms: ['ведро', 'bucket'] },
  { name: 'Тряпка для пола 50x60см', description: 'Хлопчатобумажная половая тряпка', category: 'Уборочный инвентарь', unit: 'шт', price: 55, synonyms: ['тряпка', 'cloth', 'половая тряпка'] },
  { name: 'Порошок стиральный 3кг', description: 'Стиральный порошок универсальный', category: 'Уборочный инвентарь', unit: 'упаковка', price: 420, synonyms: ['порошок', 'стиральный порошок', 'laundry powder'] },
];

// Generate additional products to reach 500
function generateMore(base: typeof PRODUCTS_DATA, total: number): typeof PRODUCTS_DATA {
  const result = [...base];
  const sizes = ['малый', 'средний', 'большой', 'профессиональный', 'эконом'];
  const quantities = ['10шт', '20шт', '50шт', '100шт'];
  let idx = base.length;

  while (result.length < total) {
    const template = base[idx % base.length];
    const size = sizes[idx % sizes.length];
    result.push({
      name: `${template.name} ${size}`,
      description: template.description,
      category: template.category,
      unit: template.unit,
      price: template.price,
      synonyms: template.synonyms,
    });
    idx++;
  }
  return result;
}

const MOCK_USERS = ['user-1', 'user-2', 'user-3'];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'search_user',
    password: process.env.POSTGRES_PASSWORD ?? 'search_pass',
    database: process.env.POSTGRES_DB ?? 'search_db',
    entities: [Product, UserBehaviorEvent, UserProductScore],
    synchronize: true,
    logging: false,
  });

  const esClient = new Client({
    node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
  });

  await dataSource.initialize();
  console.log('Database connected');

  const productRepo = dataSource.getRepository(Product);
  const eventRepo = dataSource.getRepository(UserBehaviorEvent);
  const scoreRepo = dataSource.getRepository(UserProductScore);

  // Clear existing data
  await scoreRepo.delete({});
  await eventRepo.delete({});
  await productRepo.delete({});

  // Generate 500 products
  const allProducts = generateMore(PRODUCTS_DATA, 500);

  const entities: Product[] = allProducts.map((p, i) =>
    productRepo.create({
      externalId: `STE-${String(i + 1).padStart(5, '0')}`,
      name: p.name,
      description: p.description,
      category: p.category,
      unit: p.unit,
      price: p.price,
      synonyms: p.synonyms,
    }),
  );

  const saved = await productRepo.save(entities);
  console.log(`Inserted ${saved.length} products into PostgreSQL`);

  // Ensure ES index exists
  const indexName = process.env.ELASTICSEARCH_INDEX ?? 'products';
  const exists = await esClient.indices.exists({ index: indexName });
  if (!exists) {
    await esClient.indices.create({
      index: indexName,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          externalId: { type: 'keyword' },
          name: { type: 'text', analyzer: 'russian', fields: { keyword: { type: 'keyword' } } } as Record<string, unknown>,
          description: { type: 'text', analyzer: 'russian' } as Record<string, unknown>,
          category: { type: 'text', analyzer: 'russian', fields: { keyword: { type: 'keyword' } } } as Record<string, unknown>,
          unit: { type: 'keyword' },
          price: { type: 'float' },
          synonyms: { type: 'keyword' },
          embedding: { type: 'dense_vector', dims: 768, index: false } as Record<string, unknown>,
        },
      },
    });
  }

  // Bulk index into ES
  const ops = saved.flatMap((p) => [
    { index: { _index: indexName, _id: p.id } },
    { id: p.id, externalId: p.externalId, name: p.name, description: p.description, category: p.category, unit: p.unit, price: p.price, synonyms: p.synonyms },
  ]);
  await esClient.bulk({ operations: ops, refresh: true });
  console.log(`Indexed ${saved.length} products into Elasticsearch`);

  // Seed user behavior
  const eventTypes = [EventType.VIEW, EventType.CLICK, EventType.ORDER, EventType.BOOKMARK];
  const events: UserBehaviorEvent[] = [];

  for (const userId of MOCK_USERS) {
    // Each user gets 50 random events
    for (let i = 0; i < 50; i++) {
      const product = saved[Math.floor(Math.random() * saved.length)];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      events.push(
        eventRepo.create({
          userId,
          productId: product.id,
          eventType,
          weight: EVENT_WEIGHTS[eventType],
        }),
      );
    }
  }
  await eventRepo.save(events);
  console.log(`Inserted ${events.length} behavior events`);

  // Compute scores
  type ScoreAcc = Record<string, Record<string, number>>;
  const scores: ScoreAcc = {};
  for (const ev of events) {
    if (!scores[ev.userId]) scores[ev.userId] = {};
    scores[ev.userId][ev.productId] = (scores[ev.userId][ev.productId] ?? 0) + ev.weight;
  }

  const scoreEntities: UserProductScore[] = [];
  for (const [userId, products] of Object.entries(scores)) {
    for (const [productId, score] of Object.entries(products)) {
      scoreEntities.push(scoreRepo.create({ userId, productId, score }));
    }
  }
  await scoreRepo.save(scoreEntities);
  console.log(`Computed ${scoreEntities.length} user-product scores`);

  await dataSource.destroy();
  console.log('Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
