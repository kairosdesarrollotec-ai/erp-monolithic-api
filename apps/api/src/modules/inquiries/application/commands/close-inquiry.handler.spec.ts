import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CloseInquiryHandler } from './close-inquiry.handler';
import { CloseInquiryCommand } from './close-inquiry.command';
import { InquiryNotTransitionableError } from '../../domain/inquiry-errors';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  BRANCH,
  COMPANY,
  ORG,
  SCOPE,
  buildInquiry,
  buildInquiryRepository,
  buildTransactionManager,
  buildWorkContext,
  buildMatrixAuth,
  FixedClock,
} from '../../testing/inquiry-test-fixtures';

function build(existing: ReturnType<typeof buildInquiry> | null = buildInquiry(), role: Parameters<typeof buildWorkContext>[0] = 'FRONT_OFFICE') {
  const inquiries = buildInquiryRepository(existing);
  const audit = { recordInquiryEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const transactions = buildTransactionManager();
  const matrixAuth = buildMatrixAuth();
  const outbox = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const handler = new CloseInquiryHandler(inquiries, buildWorkContext(role), audit, transactions, matrixAuth, outbox, new FixedClock(new Date('2026-10-22T15:00:00Z')));
  return { handler, inquiries, audit, transactions, matrixAuth, outbox };
}

const command = () => new CloseInquiryCommand('inq-1', 'uid-1', COMPANY, BRANCH, 1, 'CLIENTE_NO_CONTINUA', 'Precio');

describe('CloseInquiryHandler', () => {
  it('cierra sin conversion y audita en la MISMA transaccion', async () => {
    const { handler, inquiries, audit, transactions } = build();

    await handler.execute(command());

    expect(inquiries.close).toHaveBeenCalledWith(
      {
        id: 'inq-1',
        ...SCOPE,
        expectedVersion: 1,
        reason: 'CLIENTE_NO_CONTINUA',
        note: 'Precio',
        interaction: { channel: 'WHATSAPP', outcome: 'CERRADA_SIN_CONVERSION', note: 'CLIENTE_NO_CONTINUA: Precio' },
      },
      ['REGISTRADA', 'COTIZADA'],
      transactions.tx,
    );
    expect(audit.recordInquiryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INQUIRY_CLOSED_WITHOUT_CONVERSION' }),
      transactions.tx,
    );
  });

  it('publica ConsultaCerrada.v1 por outbox en la MISMA transaccion (P-07)', async () => {
    const { handler, outbox, transactions } = build();

    await handler.execute(command());

    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'inquiry',
        aggregateId: 'inq-1',
        eventType: 'ConsultaCerrada.v1',
        payload: expect.objectContaining({ inquiryId: 'inq-1', reason: 'CLIENTE_NO_CONTINUA', closedBy: 'uid-1', closedAt: '2026-10-22T15:00:00.000Z' }),
      }),
      transactions.tx,
    );
  });

  it.each(['CONVERTIDA', 'CERRADA_SIN_CONVERSION'] as const)('rechaza cerrar una consulta %s (terminal)', async (status) => {
    const { handler, inquiries } = build(buildInquiry({ status }));

    await expect(handler.execute(command())).rejects.toBeInstanceOf(InquiryNotTransitionableError);
    expect(inquiries.close).not.toHaveBeenCalled();
  });

  it('responde 404 si la consulta no esta en el scope', async () => {
    const { handler } = build(null);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['GERENCIA', 'AUDITORIA', 'ADMINISTRACION'] as const)('RBAC: rechaza cerrar con rol %s (solo lectura)', async (role) => {
    const { handler, inquiries } = build(buildInquiry(), role);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
    expect(inquiries.close).not.toHaveBeenCalled();
  });

  it('rechaza si la combinacion empresa/sede no es valida', async () => {
    const { handler } = build(buildInquiry(), 'forbidden');

    await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('consulta MatrixAuthorizationService para assertAllowed con modulo INQUIRY y accion CLOSE', async () => {
    const { handler, matrixAuth } = build();

    await handler.execute(command());

    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(ORG, 'role-FRONT_OFFICE', 'INQUIRY', 'CLOSE', expect.anything());
  });
});
