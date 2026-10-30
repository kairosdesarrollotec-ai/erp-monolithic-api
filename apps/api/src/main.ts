import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/http/domain-exception.filter';
import { securityHeadersMiddleware } from './common/http/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ADM-02: POST /admin/permissions guarda la matriz completa de una version (roles x modulos x acciones) y supera
  // los 100 kb de Express por defecto (413 Payload Too Large). Se sube el limite del JSON a 2 MB; las cargas de
  // archivos no pasan por la API (URL firmada), asi que no se necesita mas.
  app.useBodyParser('json', { limit: process.env.JSON_BODY_LIMIT ?? '2mb' });

  // F7 — cabeceras de seguridad HTTP (TDD-00 §8.1)
  app.use(securityHeadersMiddleware);

  // F2 — CORS restrictivo: solo orígenes declarados en ALLOWED_ORIGINS (TDD-00 §8.1)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-Match', 'Idempotency-Key'],
    credentials: true,
  });

  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
