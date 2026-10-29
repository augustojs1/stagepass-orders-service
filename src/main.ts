import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AppExceptionFilter } from '@/infra/filters';

async function bootstrap() {
  const PORT = process.env.PORT;
  const NODE_ENV = process.env.NODE_ENV;

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AppExceptionFilter());

  app.setGlobalPrefix('api/v1');

  app.use(
    '/api/v1/webhooks/payment/stripe',
    express.raw({ type: 'application/json' }),
  );

  await app.startAllMicroservices();
  await app.listen(PORT);

  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}! 🚀`);
}

bootstrap();
