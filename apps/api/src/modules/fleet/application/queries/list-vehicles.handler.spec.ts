import { ListVehiclesHandler } from './list-vehicles.handler';
import { ListVehiclesQuery } from './list-vehicles.query';
import { BadRequestException } from '@nestjs/common';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildFleetAccessService,
} from '../../testing/fleet-test-fixtures';

describe('ListVehiclesHandler', () => {
  it('consulta la lista de vehículos con filtros y paginación para el contexto autorizado', async () => {
    const vehicle = buildFleetVehicle();
    const repository = buildFleetVehicleRepository(vehicle);
    const { access, workContext } = buildFleetAccessService();
    const handler = new ListVehiclesHandler(repository, access);

    const query = new ListVehiclesQuery(
      'uid-1',
      COMPANY,
      BRANCH,
      BRANCH,
      'AVAILABLE',
      'Hilux',
      20,
      0,
    );

    const result = await handler.execute(query);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.list).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      status: 'AVAILABLE',
      search: 'Hilux',
      limit: 20,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  describe('disponibilidad por fechas (availableFrom / availableTo)', () => {
    const FROM = '2026-10-20';
    const TO = '2026-10-25T00:00:00.000Z';

    function setup() {
      const vehicle = buildFleetVehicle();
      const repository = buildFleetVehicleRepository(vehicle);
      const { access } = buildFleetAccessService();
      const handler = new ListVehiclesHandler(repository, access);
      const query = (from?: string, to?: string) =>
        new ListVehiclesQuery('uid-1', COMPANY, BRANCH, undefined, undefined, undefined, 50, 0, from, to);
      return { vehicle, repository, handler, query };
    }

    it('sin parámetros no agrega availability ni consulta conflictos', async () => {
      const { repository, handler, query } = setup();

      const result = await handler.execute(query());

      expect(result.items[0]).not.toHaveProperty('availability');
      expect(repository.findConflicts).not.toHaveBeenCalled();
    });

    it('ventana sin conflicto: available true', async () => {
      const { repository, handler, query } = setup();

      const result = await handler.execute(query(FROM, TO));

      expect(repository.findConflicts).toHaveBeenCalledWith(['veh-1'], new Date(FROM), new Date(TO));
      expect(result.items[0].availability).toEqual({ available: true });
    });

    it('con solape de commitment informa conflictFrom/conflictTo/conflictSource', async () => {
      const { repository, handler, query } = setup();
      const cFrom = new Date('2026-10-22T00:00:00Z');
      const cTo = new Date('2026-10-28T00:00:00Z');
      repository.findConflicts.mockResolvedValue(
        new Map([['veh-1', { vehicleId: 'veh-1', from: cFrom, to: cTo, source: 'COMMITMENT' as const }]]),
      );

      const result = await handler.execute(query(FROM, TO));

      expect(result.items[0].availability).toEqual({
        available: false,
        conflictFrom: cFrom,
        conflictTo: cTo,
        conflictSource: 'COMMITMENT',
      });
    });

    it('con solape de reserva informa conflictSource RESERVATION', async () => {
      const { repository, handler, query } = setup();
      repository.findConflicts.mockResolvedValue(
        new Map([['veh-1', { vehicleId: 'veh-1', from: new Date(FROM), to: new Date(TO), source: 'RESERVATION' as const }]]),
      );

      const result = await handler.execute(query(FROM, TO));

      expect(result.items[0].availability?.conflictSource).toBe('RESERVATION');
    });

    it('calcula en lote: una sola llamada con todos los ids de la página', async () => {
      const { repository, handler, query } = setup();
      repository.list.mockResolvedValue({
        items: [buildFleetVehicle({ id: 'a' }), buildFleetVehicle({ id: 'b' }), buildFleetVehicle({ id: 'c' })],
        total: 3,
      });

      await handler.execute(query(FROM, TO));

      expect(repository.findConflicts).toHaveBeenCalledTimes(1);
      expect(repository.findConflicts).toHaveBeenCalledWith(['a', 'b', 'c'], expect.any(Date), expect.any(Date));
    });

    it.each([
      ['solo availableFrom', FROM, undefined],
      ['solo availableTo', undefined, TO],
      ['fecha inválida', 'no-es-fecha', TO],
      ['from igual a to', FROM, FROM],
      ['from posterior a to', '2026-10-30', TO],
    ])('rechaza con 400 INVALID_AVAILABILITY_WINDOW: %s', async (_name, from, to) => {
      const { repository, handler, query } = setup();

      const error = await handler.execute(query(from, to)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'INVALID_AVAILABILITY_WINDOW' });
      expect(repository.list).not.toHaveBeenCalled();
    });
  });
});
