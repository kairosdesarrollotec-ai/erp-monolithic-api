import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotingNotProductionReadyError } from '../../domain/inquiry-errors';
import { QuoteHandler } from './quote.handler';
import { QuoteCommand } from './quote.command';
import { FleetAvailabilityPort } from '../ports/fleet-availability.port';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import {
  InquiryNotTouristUseError,
  InquiryNotTransitionableError,
  PlanRateNotConfiguredError,
  VehicleNotEligibleError,
  VehicleNotSuitableForTrochaError,
} from '../../domain/inquiry-errors';
import {
  BRANCH,
  COMPANY,
  ORG,
  FixedClock,
  SCOPE,
  buildInquiry,
  buildInquiryRepository,
  buildWorkContext,
  buildMatrixAuth,
} from '../../testing/inquiry-test-fixtures';

const NOW = new Date('2026-09-23T15:00:00Z');

function buildFleet(eligible = true, overrides: Record<string, unknown> = {}): jest.Mocked<FleetAvailabilityPort> {
  return {
    productionReady: false,
    checkEligibility: jest
      .fn()
      .mockResolvedValue(
        eligible
          ? { eligible: true, vehicleId: 'veh-1', dailyRate: '100.00', suitableForTrocha: false, rateNormal: '100.00', ratePlus: '130.00', rateLibre: '250.00', ...overrides }
          : { eligible: false, reason: 'El vehiculo indicado no existe en esta empresa.' },
      ),
  } as unknown as jest.Mocked<FleetAvailabilityPort>;
}

function build(options: { role?: Parameters<typeof buildWorkContext>[0]; eligible?: boolean; production?: boolean; allow?: boolean; existing?: ReturnType<typeof buildInquiry> | null; fleetOverrides?: Record<string, unknown> } = {}) {
  const inquiries = buildInquiryRepository(options.existing === undefined ? buildInquiry() : options.existing);
  const fleet = buildFleet(options.eligible ?? true, options.fleetOverrides ?? {});
  const guard = new ProvisionalQuotingGuard(fleet, {
    production: options.production ?? false,
    allowProvisional: options.allow ?? false,
  });
  const matrixAuth = buildMatrixAuth();
  const handler = new QuoteHandler(inquiries, buildWorkContext(options.role), fleet, guard, new FixedClock(NOW), matrixAuth);
  return { handler, inquiries, fleet, matrixAuth };
}

const command = (estimatedDays = 3, plan?: 'NORMAL' | 'PLUS' | 'LIBRE') =>
  new QuoteCommand('inq-1', 'uid-1', COMPANY, BRANCH, 1, 'veh-1', 'Vilcashuaman', estimatedDays, plan);

describe('QuoteHandler', () => {
  it('cotiza con el precio del vehiculo (Vehicle.dailyRate via FleetAvailabilityPort), vigencia de 72h calculada con el reloj inyectable', async () => {
    const { handler, inquiries, fleet } = build();

    await handler.execute(command(3));

    expect(fleet.checkEligibility).toHaveBeenCalled();
    expect(inquiries.quote).toHaveBeenCalledWith(
      {
        id: 'inq-1',
        ...SCOPE,
        expectedVersion: 1,
        vehicleId: 'veh-1',
        destination: 'Vilcashuaman',
        estimatedDays: 3,
        amount: '300.00',
        plan: 'NORMAL',
        currency: 'PEN',
        rateCardVersionId: 'FLEET-DAILY-RATE',
        validUntil: new Date('2026-09-26T15:00:00Z'),
        interaction: { channel: 'WHATSAPP', outcome: 'COTIZADA', note: expect.stringContaining('300.00') },
      },
      ['REGISTRADA', 'COTIZADA'],
    );
  });

  it('P-05: touristUse=false -> 422 INQUIRY_NOT_TOURIST_USE; no consulta Flota ni cotiza', async () => {
    const { handler, inquiries, fleet } = build({ existing: buildInquiry({ touristUse: false }) });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTouristUseError);
    expect(fleet.checkEligibility).not.toHaveBeenCalled();
    expect(inquiries.quote).not.toHaveBeenCalled();
  });

  it('consulta la elegibilidad en Flota (FleetAvailabilityPort) con el scope autorizado, destino y dias', async () => {
    const { handler, fleet } = build();

    await handler.execute(command(3));

    expect(fleet.checkEligibility).toHaveBeenCalledWith({ ...SCOPE, vehicleId: 'veh-1', destination: 'Vilcashuaman', estimatedDays: 3 });
  });

  it('pasa la fecha de viaje de la consulta (travelStartDate) como startsAt a Flota', async () => {
    const travelStartDate = new Date('2026-11-05T00:00:00Z');
    const { handler, fleet } = build({ existing: buildInquiry({ travelStartDate }) });

    await handler.execute(command(3));

    expect(fleet.checkEligibility).toHaveBeenCalledWith({
      ...SCOPE,
      vehicleId: 'veh-1',
      destination: 'Vilcashuaman',
      estimatedDays: 3,
      startsAt: travelStartDate,
    });
  });

  it('rechaza (422 VEHICLE_NOT_ELIGIBLE) un vehiculo no elegible o de otra empresa, sin cotizar', async () => {
    const { handler, inquiries } = build({ eligible: false });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(VehicleNotEligibleError);
    expect(inquiries.quote).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5])('rechaza estimatedDays invalido (%p)', async (days) => {
    const { handler } = build();

    await expect(handler.execute(command(days))).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['CONVERTIDA', 'CERRADA_SIN_CONVERSION'] as const)('rechaza cotizar una consulta %s', async (status) => {
    const { handler } = build({ existing: buildInquiry({ status }) });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTransitionableError);
  });

  it('responde 404 si la consulta no esta en el scope (p.ej. es de otra sede)', async () => {
    const { handler } = build({ existing: null });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('RBAC: rechaza cotizar con rol GERENCIA (solo lectura segun CON-01/CON-04)', async () => {
    const { handler, inquiries } = build({ role: 'GERENCIA' });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    expect(inquiries.findById).not.toHaveBeenCalled();
  });

  it('consulta MatrixAuthorizationService para assertAllowed con modulo INQUIRY y accion QUOTE', async () => {
    const { handler, matrixAuth } = build();

    await handler.execute(command());

    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'role-FRONT_OFFICE', 'INQUIRY', 'QUOTE', expect.anything());
  });

  describe('DEC-CON-TROCHA-001 / DEC-CON-PLANS-001 (Frente A)', () => {
    it('si la consulta indica trocha y el vehiculo no es apto para trocha -> 422 VEHICLE_NOT_SUITABLE_FOR_TROCHA', async () => {
      const { handler, inquiries } = build({
        existing: buildInquiry({ isDirtRoad: true }),
        fleetOverrides: { suitableForTrocha: false },
      });

      await expect(handler.execute(command(3))).rejects.toBeInstanceOf(VehicleNotSuitableForTrochaError);
      expect(inquiries.quote).not.toHaveBeenCalled();
    });

    it('si la consulta indica trocha y el vehiculo SI es apto para trocha -> cotiza exitosamente', async () => {
      const { handler, inquiries } = build({
        existing: buildInquiry({ isDirtRoad: true }),
        fleetOverrides: { suitableForTrocha: true },
      });

      await handler.execute(command(3));
      expect(inquiries.quote).toHaveBeenCalled();
    });

    it('cotiza con la tarifa del plan elegido (PLUS)', async () => {
      const { handler, inquiries } = build({
        fleetOverrides: { rateNormal: '100.00', ratePlus: '150.00', rateLibre: '280.00' },
      });

      await handler.execute(command(2, 'PLUS'));

      expect(inquiries.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '300.00',
          plan: 'PLUS',
        }),
        ['REGISTRADA', 'COTIZADA'],
      );
    });

    it('cotiza con la tarifa del plan elegido (LIBRE)', async () => {
      const { handler, inquiries } = build({
        fleetOverrides: { rateNormal: '100.00', ratePlus: '150.00', rateLibre: '280.00' },
      });

      await handler.execute(command(2, 'LIBRE'));

      expect(inquiries.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '560.00',
          plan: 'LIBRE',
        }),
        ['REGISTRADA', 'COTIZADA'],
      );
    });

    it('falla con 422 PLAN_RATE_NOT_CONFIGURED si falta la tarifa para el plan elegido', async () => {
      const { handler } = build({
        fleetOverrides: { rateNormal: '100.00', ratePlus: null, rateLibre: null },
      });

      await expect(handler.execute(command(2, 'PLUS'))).rejects.toThrow(PlanRateNotConfiguredError);
    });

    it('cotizaciones historicas no se modifican cuando cambian las tarifas de flota', async () => {
      const existingInquiry = buildInquiry({
        status: 'COTIZADA',
        quotations: [
          {
            id: 'quote-old',
            amount: '200.00',
            plan: 'NORMAL',
            vehicleId: 'veh-1',
            rateCardVersionId: 'FLEET-DAILY-RATE',
            validUntil: new Date('2026-09-26T15:00:00Z'),
            createdAt: new Date('2026-09-23T15:00:00Z'),
          },
        ],
      });

      // Modificamos tarifas de flota a un nuevo valor superior (p.ej. 250)
      const { handler, inquiries } = build({
        existing: existingInquiry,
        fleetOverrides: { rateNormal: '250.00', ratePlus: '300.00', rateLibre: '450.00' },
      });

      // Nueva cotizacion genera un nuevo snapshot con el nuevo precio sin alterar el existente
      await handler.execute(command(2, 'NORMAL'));

      expect(inquiries.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '500.00',
          plan: 'NORMAL',
        }),
        ['REGISTRADA', 'COTIZADA'],
      );
      // El registro historico previo en existingInquiry mantiene su amount '200.00'
      expect(existingInquiry.quotations[0].amount).toBe('200.00');
    });
  });
});

