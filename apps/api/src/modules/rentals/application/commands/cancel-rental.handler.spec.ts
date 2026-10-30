import { CancelRentalHandler } from './cancel-rental.handler';
import { CancelRentalCommand } from './cancel-rental.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { testRole } from '../../../users/testing/role-fixtures';

describe('CancelRentalHandler', () => {
  const fakeTx = {} as any;
  const base = {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    status: 'CONTRACTING',
    version: 3,
    deposit: null,
  } as unknown as RentalRecord;

  function build(rental: Partial<RentalRecord>) {
    const current = { ...base, ...rental } as RentalRecord;
    const rentals = {
      findById: jest.fn().mockResolvedValue(current),
      cancel: jest.fn().mockResolvedValue({ ...current, status: 'CANCELLED', version: 4 }),
      cancelOriginReservation: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<RentalRepositoryPort>;
    const workContext = {
      authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole('FRONT_OFFICE') }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MatrixAuthorizationService>;
    const transactionManager: jest.Mocked<TransactionManagerPort> = { run: jest.fn((work: any) => work(fakeTx)) };
    const clock = { now: jest.fn().mockReturnValue(new Date('2026-10-29T10:00:00Z')) } as unknown as jest.Mocked<ClockPort>;
    const audit = { recordRentalEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
    const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
    const handler = new CancelRentalHandler(rentals, workContext, matrixAuth, transactionManager, clock, audit, outbox);
    return { handler, rentals, audit };
  }

  const cmd = () => new CancelRentalCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 3, 'DOCUMENTS_INVALID');

  it('CR-03: con reserva de origen, cancelar el alquiler cancela tambien la reserva y lo audita', async () => {
    const { handler, rentals, audit } = build({ reservationId: 'res-1' });
    await handler.execute(cmd());
    expect(rentals.cancelOriginReservation).toHaveBeenCalledWith('res-1', expect.objectContaining({ organizationId: 'org-1' }), fakeTx);
    expect(audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RENTAL_CANCELLED',
        changes: expect.objectContaining({ reservationId: 'res-1', originReservationCancelled: true }),
      }),
      fakeTx,
    );
  });

  it('sin reserva de origen no intenta cancelar ninguna reserva', async () => {
    const { handler, rentals } = build({ reservationId: null });
    await handler.execute(cmd());
    expect(rentals.cancelOriginReservation).not.toHaveBeenCalled();
  });
});
