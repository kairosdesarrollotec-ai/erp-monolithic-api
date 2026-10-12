import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GlobalSearchHandler } from '../../application/queries/global-search.handler';
import { GlobalSearchQuery } from '../../application/queries/global-search.query';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';

/**
 * BUS-01 — Endpoint de búsqueda global (search.yaml, GET /search).
 *
 * Solo lectura. No modifica estado del sistema (BR-BUS-007).
 * Requiere token Firebase válido (autenticación obligatoria).
 * BR-BUS-002: aislamiento multiempresa — companyId validado contra asignación vigente.
 * BR-BUS-003: filtrado por permisos del actor.
 */
@Controller('search')
@UseGuards(FirebaseAuthGuard)
export class SearchController {
  constructor(private readonly globalSearch: GlobalSearchHandler) {}

  @Get()
  async search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.globalSearch.execute(
      new GlobalSearchQuery(
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.q,
        query.limit ?? 5,
        query.types,
      ),
    );
  }
}
