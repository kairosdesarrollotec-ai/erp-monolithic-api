import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CloseInquiryHandler } from './close-inquiry.handler';
import { CloseInquiryCommand } from './close-inquiry.command';
import { InquiryNotTransitionableError } from '../../domain/inquiry-errors';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import {
  BRANCH,
  COMPANY,
  SCOPE,
  buildInquiry,
  buildInquiryRepository,
  buildTransactionManager,
  buildWorkContext,
} from '../../testing/inquiry-test-fixtures';

function build(existing: ReturnType<typeof buildInquiry> | null = buildInquiry(), role: Parameters<typeof buildWorkContext>[0] = 'FRONT_OFFICE') {
  const inquiries = buildInquiryRepository(existing);
  const audit = { recordInquiryEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const transactions = buildTransactionManager();
  const handler = new CloseInquiryHandler(inquiries, buildWorkContext(role), audit, transactions);
  return { handler, inquiries, audit, transactions };
}

const command = () => new CloseInquiryCommand('inq-1', 'uid-1', COMPANY, BRANCH, 1, 'CLIENTE_NO_CONTINUA', 'Precio');

describe('CloseInquiryHandler', () => {
  it('cierra sin conversion y audita en la MISMA transaccion', async () => {
    const { handler, inquiries, audit, transactions } = build();

    await handler.execute(command());

    expect(inquiries.close).toHaveBeenCalledWith(
      { id: 'inq-1', ...SCOPE, expectedVersion: 1, reason: 'CLIENTE_NO_CONTINUA', note: 'Precio' },
      ['REGISTRADA', 'COTIZADA'],
      transactions.tx,
    );
    expect(audit.recordInquiryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INQUIRY_CLOSED_WITHOUT_CONVERSION' }),
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
});
