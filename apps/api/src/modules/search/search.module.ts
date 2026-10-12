import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SearchController } from './presentation/http/search.controller';
import { GlobalSearchHandler } from './application/queries/global-search.handler';

/**
 * BUS-01 — Módulo de Búsqueda Global (SDD-BUS-001, TDD-BUS-001).
 *
 * Módulo de solo lectura — no tiene tablas propias, no emite comandos de dominio,
 * no publica eventos de outbox (BR-BUS-007). Agrega resultados de los módulos
 * existentes mediante PrismaService (@Global desde PrismaModule).
 *
 * - UsersModule: exporta WorkContextAuthorizationService (contexto empresa/sede).
 * - AuthorizationModule: exporta MatrixAuthorizationService (matriz rol-permiso).
 * - PrismaModule (@Global): PrismaService disponible sin importar explícitamente.
 */
@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [SearchController],
  providers: [GlobalSearchHandler],
})
export class SearchModule {}
