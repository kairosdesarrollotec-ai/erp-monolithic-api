import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GetOperationalKpisHandler } from './get-operational-kpis.handler';
import { GetOperationalKpisQuery } from './get-operational-kpis.query';
import { validateDateRange } from './reporting.utils';

/**
 * REP-01 — Pruebas del handler de KPIs operativos.
 * BR-REP-001: requiere REPORT.READ_OPERATIONAL.
 * BR-REP-004: aislamiento multiempresa — todas las queries filtran por operatingCompanyId.
 * BR-REP-005: rango maximo 90 dias.
 */

function buildMockPrisma() {
  return {
    rental: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reservation: {
      count: jest.fn().mockResolvedValue(0),
    },
    rentalReturn: {
      count: jest.fn().mockResolvedValue(0),
    },
    vehicle: {
      count: jest.fn().mockResolvedValue(0),
    },
    incident: {
      count: jest.fn().mockResolvedValue(0),
    },
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
  if (allowed) {
    return { assertAllowed: jest.fn().mockResolvedValue(undefined) };
  }
  return {
    assertAllowed: jest.fn().mockRejectedValue(
      new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: 'Sin permiso REPORT.READ_OPERATIONAL' }),
    ),
  };
}

/** Fechas dentro del limite de 90 dias. */
function validDates() {
  return {
    dateFrom: new Date('2026-01-01'),
    dateTo: new Date('2026-03-01'),
  };
}

describe('GetOperationalKpisHandler (REP-01 / BDD-REP-001)', () => {
  describe('P0 — Aislamiento multiempresa (BR-REP-004)', () => {
    it('todas las queries de conteo incluyen operatingCompanyId del contexto de trabajo', async () => {
      const companyId = 'comp-velox';
      const branchId = 'branch-lima';
      const workContext = buildWorkContext(companyId, branchId);
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, prisma as any);
      const { dateFrom, dateTo } = validDates();
      await handler.execute(new GetOperationalKpisQuery('uid-1', companyId, branchId, dateFrom, dateTo));

      // rental.count — alquileres activos
      expect(prisma.rental.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );

      // reservation.count — reservas confirmadas
      expect(prisma.reservation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );

      // rentalReturn.count — devoluciones pendientes
      expect(prisma.rentalReturn.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );

      // vehicle.count — vehiculos disponibles y total
      expect(prisma.vehicle.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );

      // incident.count — incidencias abiertas
      expect(prisma.incident.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );

      // rental.findMany — alquileres diarios en el rango
      expect(prisma.rental.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatingCompanyId: companyId }),
        }),
      );
    });
  });

  describe('BR-REP-005 — Validacion de rango de fechas maximo 90 dias', () => {
    it('lanza BadRequestException con codigo RANGE_EXCEEDS_MAX cuando el rango supera 90 dias', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, prisma as any);
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-05-01'); // 120 dias — supera el limite

      await expect(
        handler.execute(new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', dateFrom, dateTo)),
      ).rejects.toThrow(BadRequestException);

      await expect(
        handler.execute(new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', dateFrom, dateTo)),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RANGE_EXCEEDS_MAX' }) });
    });

    it('lanza BadRequestException con codigo INVALID_DATE_RANGE cuando dateFrom es posterior a dateTo', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, prisma as any);

      await expect(
        handler.execute(
          new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', new Date('2026-05-01'), new Date('2026-01-01')),
        ),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_DATE_RANGE' }) });
    });

    it('acepta rango de exactamente 90 dias sin lanzar error', () => {
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-04-01'); // 90 dias exactos

      // validateDateRange es la funcion pura que el handler delega — se prueba directamente
      expect(() => validateDateRange(dateFrom, dateTo)).not.toThrow();
    });
  });

  describe('BR-REP-001 — Permiso REPORT.READ_OPERATIONAL', () => {
    it('lanza ForbiddenException cuando el rol no tiene permiso REPORT.READ_OPERATIONAL', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(false); // assertAllowed lanza ForbiddenException

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, {} as any);
      const { dateFrom, dateTo } = validDates();

      await expect(
        handler.execute(new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', dateFrom, dateTo)),
      ).rejects.toThrow(ForbiddenException);

      expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(
        'org-1',
        'role-OPS_MANAGER',
        'REPORT',
        'READ_OPERATIONAL',
        expect.any(Object),
      );
    });

    it('invoca assertAllowed con el modulo REPORT y accion READ_OPERATIONAL', async () => {
      const workContext = buildWorkContext();
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, prisma as any);
      const { dateFrom, dateTo } = validDates();
      await handler.execute(new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', dateFrom, dateTo));

      expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(
        'org-1',
        'role-OPS_MANAGER',
        'REPORT',
        'READ_OPERATIONAL',
        expect.objectContaining({ companyId: 'comp-1', branchId: 'branch-1' }),
      );
    });
  });

  describe('Estructura de la respuesta', () => {
    it('retorna la estructura correcta con valores de conteo del mock', async () => {
      const workContext = buildWorkContext('comp-1', 'branch-1');
      const matrixAuth = buildMatrixAuth(true);
      const prisma = buildMockPrisma();

      // Configurar conteos especificos
      prisma.rental.count
        .mockResolvedValueOnce(3)  // alquileres activos
        .mockResolvedValueOnce(10) // total vehiculos — no, vehicle.count se usa para esto
      prisma.reservation.count.mockResolvedValue(2);
      prisma.rentalReturn.count.mockResolvedValue(1);
      prisma.vehicle.count
        .mockResolvedValueOnce(5)  // AVAILABLE
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(8); // RENTED
      prisma.incident.count.mockResolvedValue(4);

      const handler = new GetOperationalKpisHandler(workContext as any, matrixAuth as any, prisma as any);
      const { dateFrom, dateTo } = validDates();
      const result = await handler.execute(
        new GetOperationalKpisQuery('uid-1', 'comp-1', 'branch-1', dateFrom, dateTo),
      );

      expect(result.companyId).toBe('comp-1');
      expect(result.branchId).toBe('branch-1');
      expect(result.kpis).toBeDefined();
      expect(result.kpis.activeRentals).toBe(3);
      expect(result.kpis.activeReservations).toBe(2);
      expect(result.kpis.pendingReturns).toBe(1);
      expect(result.kpis.openIncidents).toBe(4);
      expect(result.kpis.dailyRentals).toEqual([]);
      expect(result.generatedAt).toBeDefined();
    });
  });
});
