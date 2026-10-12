import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import {
  ENTITY_LABELS,
  ENTITY_ROUTES,
  SearchEntityType,
  SearchResponse,
  SearchResultItem,
} from '../../domain/search-result.entity';
import { GlobalSearchQuery } from './global-search.query';

/**
 * BUS-01 — Handler de búsqueda global (TDD-BUS-001 §4, BDD-BUS-001 §3).
 *
 * Pasos:
 * 1. Valida contexto trabajo (empresa/sede del actor) — BR-BUS-002.
 * 2. Filtra tipos de entidad por permisos del actor (isAllowed, sin throw) — BR-BUS-003.
 * 3. Ejecuta queries en paralelo (Promise.all) — solo SELECT.
 * 4. Cada query incluye WHERE operatingCompanyId = ctx.companyId — BR-BUS-002.
 * 5. Devuelve hasta 5 resultados por grupo, máx. 3 grupos — BR-BUS-005.
 *
 * Nota de implementación: los modelos Rental, Reservation y RentalReturn no tienen
 * un campo `code` en el esquema Prisma vigente (rentals, reservations, returns solo
 * exponen UUID como id). Los TDD y BDD mencionan códigos ALQ/RES/DEV — esos campos
 * no existen aún en la BD; la búsqueda sobre estos modelos se realiza por los campos
 * relacionados disponibles (customer.full_name, vehicle.plate). Cuando se agreguen
 * los campos de código, se deben añadir como condición adicional en cada bloque OR.
 * Ver: SOURCE_CONFLICT documentado en artifacts/traceability/search-code-field.md.
 *
 * BR-BUS-008: no se retornan ni seleccionan campos biométricos, contraseñas ni
 * documentos completos.
 */

type TypePermission = {
  module: string;
  action: string;
};

const TYPE_PERMISSIONS: Record<SearchEntityType, TypePermission> = {
  RENTAL: { module: 'RENTAL', action: 'READ' },
  RESERVATION: { module: 'RESERVATION', action: 'READ_LIST' },
  CUSTOMER: { module: 'CUSTOMER', action: 'READ' },
  VEHICLE: { module: 'FLEET', action: 'READ' },
  RETURN: { module: 'RETURN', action: 'READ' },
};

const ALL_TYPES: SearchEntityType[] = ['RENTAL', 'RESERVATION', 'CUSTOMER', 'VEHICLE', 'RETURN'];

/** Máximo 3 grupos visibles en el dropdown (BR-BUS-005). */
const MAX_GROUPS = 3;

@Injectable()
export class GlobalSearchHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GlobalSearchQuery): Promise<SearchResponse> {
    // 1. Validar contexto de trabajo (empresa/sede). El branchId es requerido por
    //    WorkContextAuthorizationService; si no viene en el request usamos companyId
    //    como fallback (contexto empresa sin sede específica).
    const ctx = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId ?? query.companyId,
    });

    // 2. Determinar tipos a consultar
    const requestedTypes: SearchEntityType[] = query.types?.length
      ? (query.types as SearchEntityType[])
      : ALL_TYPES;

    // 3. Filtrar por permisos del actor (deny-by-default, sin throw — BR-BUS-003)
    const scope = { companyId: ctx.companyId, branchId: ctx.branchId };
    const allowedTypeFlags = await Promise.all(
      requestedTypes.map(async (type) => {
        const { module, action } = TYPE_PERMISSIONS[type];
        const allowed = await this.matrixAuth.isAllowed(
          ctx.organizationId,
          ctx.roleId,
          module as Parameters<typeof this.matrixAuth.isAllowed>[2],
          action,
          scope,
        );
        return allowed ? type : null;
      }),
    );
    const allowedTypes = allowedTypeFlags.filter((t): t is SearchEntityType => t !== null);

    if (allowedTypes.length === 0) {
      throw new ForbiddenException({
        code: 'NO_SEARCH_PERMISSIONS',
        detail: 'El actor no tiene permiso de lectura en ningún módulo indexado.',
      });
    }

    const { q, limit } = query;
    const term = `%${q}%`;

    // 4. Ejecutar queries en paralelo (solo las permitidas) — BR-BUS-002: WHERE operatingCompanyId
    const queryResults = await Promise.all(
      allowedTypes.map((type) => this.runQuery(type, ctx.companyId, term, limit)),
    );

    // 5. Agrupar, descartar grupos vacíos y limitar a MAX_GROUPS (BR-BUS-005)
    const groups = allowedTypes
      .map((type, i) => ({
        type,
        label: ENTITY_LABELS[type],
        results: queryResults[i],
      }))
      .filter((g) => g.results.length > 0)
      .slice(0, MAX_GROUPS);

    return {
      query: q,
      groups,
      totalGroups: groups.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private async runQuery(
    type: SearchEntityType,
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    switch (type) {
      case 'RENTAL':
        return this.searchRentals(operatingCompanyId, term, limit);
      case 'RESERVATION':
        return this.searchReservations(operatingCompanyId, term, limit);
      case 'CUSTOMER':
        return this.searchCustomers(operatingCompanyId, term, limit);
      case 'VEHICLE':
        return this.searchVehicles(operatingCompanyId, term, limit);
      case 'RETURN':
        return this.searchReturns(operatingCompanyId, term, limit);
    }
  }

  /**
   * Busca alquileres por nombre del cliente o placa del vehículo.
   * Nota: el campo `code` (ALQ-XXXX) no existe en el esquema actual — ver comentario
   * en clase. Cuando se agregue, añadir: OR r.code ILIKE :term.
   */
  private async searchRentals(
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const rows = await this.prisma.rental.findMany({
      where: {
        operatingCompanyId,
        OR: [
          { customer: { fullName: { contains: term.slice(1, -1), mode: 'insensitive' } } },
          { vehicle: { plate: { contains: term.slice(1, -1), mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        customer: { select: { fullName: true } },
        vehicle: { select: { plate: true, brand: true, model: true } },
      },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'RENTAL' as SearchEntityType,
      title: r.customer.fullName,
      subtitle: r.vehicle.plate ? `${r.vehicle.brand} ${r.vehicle.model} · ${r.vehicle.plate}` : null,
      route: ENTITY_ROUTES.RENTAL(r.id),
    }));
  }

  /**
   * Busca reservas por nombre del cliente o placa del vehículo.
   * Nota: el campo `code` (RES-XXXX) no existe en el esquema actual.
   */
  private async searchReservations(
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        operatingCompanyId,
        OR: [
          { customer: { fullName: { contains: term.slice(1, -1), mode: 'insensitive' } } },
          { vehicle: { plate: { contains: term.slice(1, -1), mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        customer: { select: { fullName: true } },
        vehicle: { select: { plate: true, brand: true, model: true } },
        status: true,
      },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'RESERVATION' as SearchEntityType,
      title: r.customer.fullName,
      subtitle: r.vehicle.plate ? `${r.vehicle.brand} ${r.vehicle.model} · ${r.vehicle.plate}` : null,
      route: ENTITY_ROUTES.RESERVATION(r.id),
    }));
  }

  /** Busca clientes por nombre completo, número de documento o correo. */
  private async searchCustomers(
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const q = term.slice(1, -1); // quitar los % para el contains
    const rows = await this.prisma.customer.findMany({
      where: {
        operatingCompanyId,
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { documentNumber: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        documentType: true,
        documentNumber: true,
        email: true,
      },
      take: limit,
    });

    return rows.map((c) => ({
      id: c.id,
      type: 'CUSTOMER' as SearchEntityType,
      title: c.fullName,
      subtitle: `${c.documentType} ${c.documentNumber}`,
      route: ENTITY_ROUTES.CUSTOMER(c.id),
    }));
  }

  /** Busca vehículos por placa, marca o modelo. */
  private async searchVehicles(
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const q = term.slice(1, -1);
    const rows = await this.prisma.vehicle.findMany({
      where: {
        operatingCompanyId,
        OR: [
          { plate: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        year: true,
        status: true,
      },
      take: limit,
    });

    return rows.map((v) => ({
      id: v.id,
      type: 'VEHICLE' as SearchEntityType,
      title: v.plate,
      subtitle: `${v.brand} ${v.model}${v.year ? ` · ${v.year}` : ''}`,
      route: ENTITY_ROUTES.VEHICLE(v.id),
    }));
  }

  /**
   * Busca devoluciones por nombre del cliente.
   * Nota: el campo `code` (DEV-XXXX) no existe en el esquema actual.
   */
  private async searchReturns(
    operatingCompanyId: string,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const q = term.slice(1, -1);
    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        operatingCompanyId,
        customer: { fullName: { contains: q, mode: 'insensitive' } },
      },
      select: {
        id: true,
        customer: { select: { fullName: true } },
        vehicle: { select: { plate: true } },
        status: true,
      },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'RETURN' as SearchEntityType,
      title: r.customer.fullName,
      subtitle: r.vehicle.plate ?? null,
      route: ENTITY_ROUTES.RETURN(r.id),
    }));
  }
}
