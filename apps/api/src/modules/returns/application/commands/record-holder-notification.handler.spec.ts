import { RecordHolderNotificationHandler } from './record-holder-notification.handler';
import { RecordHolderNotificationCommand } from './record-holder-notification.command';
import { ReturnNotFoundError } from '../../domain/return-errors';
import {
  applyUpdate,
  buildDeps,
  buildReturnRecord,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';

describe('RecordHolderNotificationHandler (SC-DEV-004.01, EX-DEV-001)', () => {
  function build(overrides: Partial<ReturnRecord> = {}) {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const base = buildReturnRecord({
      status: 'INSPECCION',
      version: 3,
      signerIsHolder: false,
      signerName: 'Pedro Gomez',
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const mockDashboardAlerts = {
      listWarrantyCandidates: jest.fn(),
      createDashboardItems: jest.fn(),
      listActiveWarrantyItems: jest.fn(),
      listActiveItems: jest.fn().mockResolvedValue([{ id: 'dash-item-1' }]),
      listLateChargeCandidates: jest.fn(),
      listImmobilizationCandidates: jest.fn(),
      findReturnsByIds: jest.fn(),
      dismissItems: jest.fn().mockResolvedValue(1),
    };
    const handler = new RecordHolderNotificationHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
      mockDashboardAlerts as any,
    );
    return { deps, handler, base, mockDashboardAlerts };
  }

  it('registra la notificación formal al titular ausente, audita, publica outbox y descarta la alerta in-app', async () => {
    const { deps, handler, mockDashboardAlerts } = build();
    const contactedAt = new Date('2026-10-27T10:00:00.000Z');
    const cmd = new RecordHolderNotificationCommand(
      'ret-1',
      'user-front-1',
      'comp-1',
      'branch-1',
      3,
      'WHATSAPP',
      contactedAt,
      'Asesor Juan',
      'Se envió copia del acta y fotos del estado de entrega.',
    );

    const result = await handler.execute(cmd);

    expect(result.holderNotificationSent).toBe(true);
    expect(result.holderNotificationSentAt).toEqual(contactedAt);
    expect(result.holderNotificationSentBy).toBe('Asesor Juan');
    expect(result.holderNotificationChannel).toBe('WHATSAPP');
    expect(result.holderNotificationNotes).toBe('Se envió copia del acta y fotos del estado de entrega.');

    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_HOLDER_NOTIFICATION_RECORDED',
        changes: expect.objectContaining({
          returnId: 'ret-1',
          channel: 'WHATSAPP',
          contactedAt: contactedAt.toISOString(),
          notifiedBy: 'Asesor Juan',
          observations: 'Se envió copia del acta y fotos del estado de entrega.',
        }),
      }),
      expect.anything(),
    );

    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'NotificacionTitularAusenteRegistrada.v1',
        payload: expect.objectContaining({
          returnId: 'ret-1',
          channel: 'WHATSAPP',
          notifiedBy: 'Asesor Juan',
        }),
      }),
      expect.anything(),
    );

    expect(mockDashboardAlerts.listActiveItems).toHaveBeenCalledWith('return-holder-notification:ret-1', 10);
    expect(mockDashboardAlerts.dismissItems).toHaveBeenCalledWith(['dash-item-1'], expect.any(Date));
  });

  it('si la devolución no existe lanza ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new RecordHolderNotificationCommand(
          'bad-id',
          'user-1',
          'comp-1',
          'branch-1',
          1,
          'TELEFONO',
          new Date(),
          'Asesor Juan',
        ),
      ),
    ).rejects.toThrow(ReturnNotFoundError);
  });
});
