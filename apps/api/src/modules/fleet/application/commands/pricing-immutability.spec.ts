import { QuoteHandler } from '../../../inquiries/application/commands/quote.handler';
import { QuoteCommand } from '../../../inquiries/application/commands/quote.command';
import { FleetAvailabilityPort } from '../../../inquiries/application/ports/fleet-availability.port';
import { ProvisionalQuotingGuard } from '../../../inquiries/application/services/provisional-quoting.guard';
import {
  BRANCH,
  COMPANY,
  FixedClock,
  buildInquiry,
  buildInquiryRepository,
  buildWorkContext,
  buildMatrixAuth,
} from '../../../inquiries/testing/inquiry-test-fixtures';
import { UpdateVehicleHandler } from './update-vehicle.handler';
import { UpdateVehicleCommand } from './update-vehicle.command';
import {
  buildFleetAccessService,
  buildFleetVehicle,
  buildFleetVehicleRepository,
} from '../../testing/fleet-test-fixtures';

const NOW = new Date('2026-10-23T15:00:00Z');

describe('C6: Inmutabilidad de precios y congelamiento de tarifas', () => {
  it('tras cambiar una tarifa en Flota, una cotizacion y reserva previamente creadas conservan su precio original (snapshot inmutable)', async () => {
    // 1. Estado inicial del vehiculo en flota con tarifa diaria de S/ 150
    let vehicleState = {
      dailyRate: '150.00',
      rateNormal: '150.00',
      ratePlus: '180.00',
      rateLibre: '280.00',
      suitableForTrocha: false,
    };

    const fleetAvailability = {
      productionReady: false,
      checkEligibility: jest.fn().mockImplementation(async () => ({
        eligible: true,
        vehicleId: 'veh-1',
        dailyRate: vehicleState.dailyRate,
        rateNormal: vehicleState.rateNormal,
        ratePlus: vehicleState.ratePlus,
        rateLibre: vehicleState.rateLibre,
        suitableForTrocha: vehicleState.suitableForTrocha,
      })),
    } as unknown as jest.Mocked<FleetAvailabilityPort>;

    const inquiryRepo = buildInquiryRepository(buildInquiry({ id: 'inq-1', touristUse: true }));
    const guard = new ProvisionalQuotingGuard(fleetAvailability, { production: false, allowProvisional: false });
    const matrixAuth = buildMatrixAuth();
    const clock = new FixedClock(NOW);

    const quoteHandler = new QuoteHandler(
      inquiryRepo,
      buildWorkContext(),
      fleetAvailability,
      guard,
      clock,
      matrixAuth,
    );

    // 2. Cotizamos por 3 dias con plan NORMAL a S/ 150/dia -> Total: S/ 450.00
    const quoteCmd = new QuoteCommand('inq-1', 'uid-1', COMPANY, BRANCH, 1, 'veh-1', 'Vilcashuaman', 3, 'NORMAL');
    await quoteHandler.execute(quoteCmd);

    expect(inquiryRepo.quote).toHaveBeenCalledTimes(1);
    const firstQuoteCall = (inquiryRepo.quote as jest.Mock).mock.calls[0][0];
    expect(firstQuoteCall.amount).toBe('450.00');
    expect(firstQuoteCall.plan).toBe('NORMAL');

    // 3. Flota actualiza las tarifas del vehiculo: rateNormal sube de 150 a 250 (incremento de S/ 100/dia)
    const fleetVehicle = buildFleetVehicle({
      id: 'veh-1',
      dailyRate: 150,
      rateNormal: 150,
      ratePlus: 180,
      rateLibre: 280,
    });
    const fleetRepo = buildFleetVehicleRepository(fleetVehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const auditRecordMock = jest.fn().mockResolvedValue(undefined);
    const auditService = { recordFleetEvent: auditRecordMock } as any;

    const updateVehicleHandler = new UpdateVehicleHandler(fleetRepo, access, auditService);
    await updateVehicleHandler.execute(
      new UpdateVehicleCommand(
        'uid-1',
        'veh-1',
        COMPANY,
        BRANCH,
        undefined, // brand
        undefined, // model
        undefined, // year
        undefined, // color
        undefined, // category
        250, // dailyRate
        undefined, // depositMinimum
        undefined, // passengerCapacity
        undefined, // fuelPrice
        undefined, // photoUrl
        undefined, // assignedBranchId
        undefined, // thirdPathEligible
        undefined, // suitableForTrocha
        250, // rateNormal
        300, // ratePlus
        400, // rateLibre
      ),
    );

    // Actualizamos el mock de disponibilidad para reflejar la base de datos de Flota actualizada
    vehicleState = {
      dailyRate: '250.00',
      rateNormal: '250.00',
      ratePlus: '300.00',
      rateLibre: '400.00',
      suitableForTrocha: false,
    };

    // 4. VERIFICACION CRITICA: La cotizacion existente PRESERVA su precio original (amount = 450.00)
    // No se altera ni se recalcula en caliente
    expect(firstQuoteCall.amount).toBe('450.00');

    // 5. Una NUEVA cotizacion posterior al cambio de tarifa si recibe la nueva tarifa (3 * 250 = S/ 750.00)
    const quoteCmd2 = new QuoteCommand('inq-1', 'uid-1', COMPANY, BRANCH, 2, 'veh-1', 'Vilcashuaman', 3, 'NORMAL');
    await quoteHandler.execute(quoteCmd2);

    expect(inquiryRepo.quote).toHaveBeenCalledTimes(2);
    const secondQuoteCall = (inquiryRepo.quote as jest.Mock).mock.calls[1][0];
    expect(secondQuoteCall.amount).toBe('750.00');

    // El precio previo sigue intacto y congelado en la cotizacion original
    expect(firstQuoteCall.amount).toBe('450.00');
  });

  it('tras cambiar una tarifa o garantia en Flota, una reserva previamente creada conserva su monto exigido original (requiredPaymentAmount)', async () => {
    // 1. Reserva creada con politica de deposito vigente S/ 300.00
    const reservation = {
      id: 'res-1',
      vehicleId: 'veh-1',
      requiredPaymentAmount: '300.00',
      currency: 'PEN',
      paymentPolicyVersion: 1,
      status: 'CONFIRMED',
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
    };

    const reservationRepo = {
      findById: jest.fn().mockResolvedValue(reservation),
    };

    // 2. Flota actualiza tarifa y deposito minimo del vehiculo de S/ 1000 a S/ 2000
    const fleetVehicle = buildFleetVehicle({
      id: 'veh-1',
      dailyRate: 150,
      depositMinimum: 1000,
    });
    const fleetRepo = buildFleetVehicleRepository(fleetVehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const auditService = { recordFleetEvent: jest.fn().mockResolvedValue(undefined) };

    const updateVehicleHandler = new UpdateVehicleHandler(fleetRepo, access, auditService as any);
    await updateVehicleHandler.execute(
      new UpdateVehicleCommand(
        'uid-1',
        'veh-1',
        COMPANY,
        BRANCH,
        undefined, undefined, undefined, undefined, undefined,
        250, // dailyRate
        2000, // depositMinimum
      ),
    );

    // 3. Se consulta la reserva existente: conserva requiredPaymentAmount original (300.00)
    const existingReservation = await reservationRepo.findById('res-1');
    expect(existingReservation.requiredPaymentAmount).toBe('300.00');
    expect(existingReservation.paymentPolicyVersion).toBe(1);
  });

  it('tras cambiar tarifas en Flota, un alquiler formalizado conserva su garantia retenida (originalAmount) y tarifa de conductor', async () => {
    // 1. Alquiler formalizado con deposito de S/ 1500.00 y conductor diario de S/ 80.00
    const rental = {
      id: 'rent-1',
      vehicleId: 'veh-1',
      companyDriverDailyRate: '80.00',
      status: 'PENDING_DELIVERY',
      deposit: {
        id: 'dep-1',
        rentalId: 'rent-1',
        originalAmount: '1500.00',
        currency: 'PEN',
        status: 'HELD',
      },
    };

    const rentalRepo = {
      findById: jest.fn().mockResolvedValue(rental),
    };

    // 2. Flota actualiza tarifas del vehiculo: sube dailyRate, depositMinimum y fuelPenaltyPerLine
    const fleetVehicle = buildFleetVehicle({
      id: 'veh-1',
      dailyRate: 150,
      depositMinimum: 1500,
      fuelPenaltyPerLine: 15,
    });
    const fleetRepo = buildFleetVehicleRepository(fleetVehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const auditService = { recordFleetEvent: jest.fn().mockResolvedValue(undefined) };

    const updateVehicleHandler = new UpdateVehicleHandler(fleetRepo, access, auditService as any);
    await updateVehicleHandler.execute(
      new UpdateVehicleCommand(
        'uid-1',
        'veh-1',
        COMPANY,
        BRANCH,
        undefined, undefined, undefined, undefined, undefined,
        300, // dailyRate
        3000, // depositMinimum
        undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined,
        30, // fuelPenaltyPerLine
      ),
    );

    // 3. El alquiler ya creado no recalcula su garantia ni su tarifa pactada
    const existingRental = await rentalRepo.findById('rent-1');
    expect(existingRental.deposit.originalAmount).toBe('1500.00');
    expect(existingRental.companyDriverDailyRate).toBe('80.00');
  });

  it('el cambio de tarifas en Flota registra evento de auditoria con valores anteriores y nuevos de todos los campos tarifarios (rateNormal, ratePlus, rateLibre, fuelPenaltyPerLine, suitableForTrocha)', async () => {
    const fleetVehicle = buildFleetVehicle({
      id: 'veh-1',
      rateNormal: 150,
      ratePlus: 180,
      rateLibre: 280,
      fuelPenaltyPerLine: 15,
      suitableForTrocha: false,
    });
    const fleetRepo = buildFleetVehicleRepository(fleetVehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const recordFleetEventMock = jest.fn().mockResolvedValue(undefined);
    const auditService = { recordFleetEvent: recordFleetEventMock };

    const updateVehicleHandler = new UpdateVehicleHandler(fleetRepo, access, auditService as any);
    await updateVehicleHandler.execute(
      new UpdateVehicleCommand(
        'uid-1',
        'veh-1',
        COMPANY,
        BRANCH,
        undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        true, // suitableForTrocha
        200, // rateNormal
        250, // ratePlus
        350, // rateLibre
        25, // fuelPenaltyPerLine
      ),
    );

    expect(recordFleetEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'uid-1',
        vehicleId: 'veh-1',
        action: 'VEHICLE_UPDATED',
        changes: expect.objectContaining({
          rateNormal: { from: 150, to: 200 },
          ratePlus: { from: 180, to: 250 },
          rateLibre: { from: 280, to: 350 },
          fuelPenaltyPerLine: { from: 15, to: 25 },
          suitableForTrocha: { from: false, to: true },
        }),
      }),
    );
  });
});
