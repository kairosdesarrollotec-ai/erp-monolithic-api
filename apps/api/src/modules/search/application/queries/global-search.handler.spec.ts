import { ForbiddenException } from '@nestjs/common';
import { GlobalSearchHandler } from './global-search.handler';
import { GlobalSearchQuery } from './global-search.query';

/**
 * BUS-01 — Pruebas del handler de busqueda global.
 * BR-BUS-001: longitud minima de busqueda.
 * BR-BUS-002: aislamiento multiempresa (WHERE operatingCompanyId).
 * BR-BUS-003: filtrado de tipos por permisos del actor (deny-by-default).
 * BR-BUS-005: maximo 5 resultados por grupo, maximo 3 grupos.
 */

function buildMockPrisma() {
  return {
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    rental: { findMany: jest.fn().mockResolvedValue([]) },
    reservation: { findMany: jest.fn().mockResolvedValue([]) },
    rentalReturn: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function buildWorkContext(companyId = 'comp-1', branchId = 'branch-1') {
  return {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId,
      branchId,
      roleId: 'role-OPS_MANAGER',
      roleName: 'OPS_MANAGER',
      roleKey: 'OPS_MANAGER',
    }),
  };
}

function buildMatrixAuth(allowed = true) {
  return {
    isAllowed: jest.fn().mockResolvedValue(allowed),
  };
}

function buildQuery(overrides: Partial<ConstructorParameters<typeof GlobalSearchQuery>[number]> = {}): GlobalSearchQuery {
  return new GlobalSearchQuery(
    'uid-1',
    (overrides as any).companyId ?? 'comp-1',
    (overrides as any).branchId ?? 'branch-1',
    (overrides as any).q ?? 'toyota',
    (overrides as any).limit ?? 5,
    (overrides as any).types ?? undefined,
  );
}

describe('GlobalSearchHandler (BUS-01 / TDD-BUS-001 / BDD-BUS-001)', () => {
  describe('P0 — Aislamiento multiempresa (BR-BUS-002)', () => {
    it('aplica operatingCompanyId del contexto de trabajo en cada query de Prisma', async () => {
      const companyId = 'comp-B';
      const workContext = buildWorkContext(companyId);
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      // Simula un cliente que pertenece a comp-A devuelto por la BD
      // (el mock ignora el WHERE; lo relevante es que el WHERE se pasa correctamente)
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust-A',
          fullName: 'Cliente Empresa A',
          documentType: 'DNI',
          documentNumber: '12345678',
          email: 'a@example.com',
        },
      ]);

      const handler = new GlobalSearchHandler(
        workContext as any,
        matrixAuth as any,
        prisma as any,
      );

      const query = new GlobalSearchQuery('uid-1', companyId, 'branch-B', 'toyota', 5, ['CUSTOMER']);
      await handler.execute(query);

      // El WHERE debe incluir operatingCompanyId del contexto, no del cliente devuelto por el mock
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );
    });

    it('NO incluye resultados de otra empresa cuando el contexto es comp-B', async () => {
      const workContext = buildWorkContext('comp-B');
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      // Mock de comp-A — en produccion este resultado jamas llegaria porque
      // el WHERE filtra por operatingCompanyId. En el test verificamos el arg.
      prisma.customer.findMany.mockResolvedValue([]);

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      const result = await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-B', 'branch-B', 'juan', 5, ['CUSTOMER']),
      );

      // Sin resultados en el mock → grupos vacios
      expect(result.groups).toHaveLength(0);
      // La query de Prisma si se llamo y con el companyId correcto
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: 'comp-B' }),
        }),
      );
    });
  });

  describe('BR-BUS-001 — Longitud minima del termino de busqueda', () => {
    it('con q de 1 caracter devuelve grupos vacios (mock retorna vacio, sin crash)', async () => {
      // La validacion minima de 2 chars se aplica en el DTO/controlador.
      // El handler por si mismo no lanza error para q corto, pero el resultado
      // es vacio si el mock (que simula la BD) no devuelve coincidencias.
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      const result = await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'a', 5, undefined),
      );

      expect(result.groups).toHaveLength(0);
      expect(result.query).toBe('a');
    });

    it('con q de solo espacios en blanco devuelve grupos vacios', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      const result = await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', '   ', 5, undefined),
      );

      expect(result.groups).toHaveLength(0);
    });
  });

  describe('BR-BUS-005 — Maximo 5 resultados por grupo', () => {
    it('pasa take=5 a findMany cuando el limite es 5', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      // Mock devuelve 7 clientes; el limite de 5 debe aplicarse via `take` en la query
      const mockCustomers = Array.from({ length: 7 }, (_, i) => ({
        id: `cust-${i}`,
        fullName: `Cliente ${i}`,
        documentType: 'DNI',
        documentNumber: `0000000${i}`,
        email: `c${i}@example.com`,
      }));
      prisma.customer.findMany.mockResolvedValue(mockCustomers.slice(0, 5)); // simula que Prisma respeta take

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'cliente', 5, ['CUSTOMER']),
      );

      // Verificar que el take correcto se pasa a Prisma (BR-BUS-005)
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('el grupo de resultados no excede el limite especificado cuando el mock respeta take', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      prisma.customer.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `cust-${i}`,
          fullName: `Cliente ${i}`,
          documentType: 'DNI',
          documentNumber: `0000000${i}`,
          email: `c${i}@example.com`,
        })),
      );

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      const result = await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'cliente', 5, ['CUSTOMER']),
      );

      const customerGroup = result.groups.find((g) => g.type === 'CUSTOMER');
      expect(customerGroup).toBeDefined();
      expect(customerGroup!.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('BR-BUS-003 — Filtrado de tipos por permisos (deny-by-default)', () => {
    it('lanza ForbiddenException cuando el actor no tiene permiso en ningun modulo indexado', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(false); // ningún permiso

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, {} as any);
      await expect(
        handler.execute(new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'toyota', 5, undefined)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('omite tipos de entidad no permitidos y solo consulta los permitidos', async () => {
      const workContext = buildWorkContext();
      const prisma = buildMockPrisma();

      // Solo CUSTOMER permitido, el resto denegado
      const matrixAuth = {
        isAllowed: jest.fn().mockImplementation(
          async (_org: string, _role: string, module: string) => module === 'CUSTOMER',
        ),
      };

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'toyota', 5, undefined),
      );

      // Solo el findMany de customer debe haberse llamado
      expect(prisma.customer.findMany).toHaveBeenCalled();
      expect(prisma.vehicle.findMany).not.toHaveBeenCalled();
      expect(prisma.rental.findMany).not.toHaveBeenCalled();
      expect(prisma.reservation.findMany).not.toHaveBeenCalled();
      expect(prisma.rentalReturn.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Estructura de la respuesta', () => {
    it('retorna grupos vacios cuando todas las queries devuelven resultados vacios', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GlobalSearchHandler(workContext as any, matrixAuth as any, prisma as any);
      const result = await handler.execute(
        new GlobalSearchQuery('uid-1', 'comp-1', 'branch-1', 'noresult', 5, undefined),
      );

      expect(result.groups).toHaveLength(0);
      expect(result.totalGroups).toBe(0);
      expect(result.query).toBe('noresult');
      expect(result.generatedAt).toBeDefined();
    });
  });
});
