import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Global exception filter (RFC 7807)
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS for frontend — wildcard origin blocks withCredentials cookies,
  // so we explicitly allow the dev origin and reflect the request origin in Docker.
  const allowedOrigins = [
    'http://localhost:4200', // ng serve
    'http://localhost:3000', // SSR / direct
  ];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Swagger
  const docConfig = new DocumentBuilder()
    .setTitle('Персонализированный умный поиск продукции')
    .setDescription('Smart product search backend for zakupki.mos.ru')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap().catch(console.error);
