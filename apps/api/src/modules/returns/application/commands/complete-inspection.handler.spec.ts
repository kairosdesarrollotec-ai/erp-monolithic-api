import { CompleteInspectionHandler } from './complete-inspection.handler';
import { CompleteInspectionCommand } from './complete-inspection.command';
import {
  MissingResponsibilityDocumentError,
  MissingReturnEvidenceError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { applyUpdate, buildDeps, buildReturnRecord, FIXED_NOW, fakeTx } from '../../testing/return-test-fixtures';

const DOC = { signerName: 'Juan Perez', signerIsHolder: true, signatureData: 'data:image/png;base64,AAAA' };

describe('CompleteInspectionHandler (DEV-04 / DEV-05 / BR-DEV-009)', () => {
  function build(status: 'INSPECCION' | 'RECEPCION_PROVISIONAL' = 'INSPECCION') {
    const deps = buildDeps({ role: 'CAMPO' });
    deps.returns.findById.mockResolvedValue(buildReturnRecord({ status, custodyHolder: 'VELOXRENT', version: 5, notes: 'previa' }));
    deps.returns.countEvidenceByType.mockResolvedValue({ photos: 35, videos: 3 });
    deps.returns.update.mockImplementation(async (input) =>
      applyUpdate(buildReturnRecord({ status, custodyHolder: 'VELOXRENT', version: input.expectedVersion }), input),
    );
    const handler = new CompleteInspectionHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  it('sin daños con evidencia completa -> SIN_DANOS e inspectedAt', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false, undefined, undefined, DOC));
    expect(result.status).toBe('SIN_DANOS');
    expect(result.inspectedAt).toEqual(FIXED_NOW);
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'InspeccionRetornoCompletada.v1' }),
      fakeTx,
    );
  });

  it('con daños -> CON_DANOS y conserva la descripción en las notas', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(
      new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, true, 'rayón en capot', 'cliente presente', DOC),
    );
    expect(result.status).toBe('CON_DANOS');
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'previa\ncliente presente\nDaños observados: rayón en capot' }),
      fakeTx,
    );
  });

  it('evidencia insuficiente -> MissingReturnEvidenceError y no muta el expediente (BR-DEV-009)', async () => {
    const { deps, handler } = build();
    deps.returns.countEvidenceByType.mockResolvedValue({ photos: 20, videos: 3 });
    await expect(
      handler.execute(new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false, undefined, undefined, DOC)),
    ).rejects.toThrow(MissingReturnEvidenceError);
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('estado distinto de INSPECCION -> ReturnStateConflictError', async () => {
    const { handler } = build('RECEPCION_PROVISIONAL');
    await expect(
      handler.execute(new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false, undefined, undefined, DOC)),
    ).rejects.toThrow(ReturnStateConflictError);
  });

  it('persiste el documento de responsabilidad y no filtra signatureData a audit/outbox', async () => {
    const { deps, handler } = build();
    await handler.execute(
      new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false, undefined, undefined, {
        signerName: ' Maria Lopez ',
        signerIsHolder: false,
        signerRelationToHolder: 'Hermana',
        signatureData: 'data:image/png;base64,BBBB',
      }),
    );
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        responsibilitySignerName: 'Maria Lopez',
        responsibilitySignerIsHolder: false,
        responsibilitySignerRelation: 'Hermana',
        responsibilitySignatureData: 'data:image/png;base64,BBBB',
        responsibilitySignedAt: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(JSON.stringify(deps.auditRepository.recordRentalEvent.mock.calls)).not.toContain('BBBB');
    expect(JSON.stringify(deps.outboxRepository.publish.mock.calls)).not.toContain('BBBB');
  });

  it('sin documento de responsabilidad -> 422 MISSING_RESPONSIBILITY_DOCUMENT y no muta el expediente', async () => {
    const { deps, handler } = build();
    const error = await handler
      .execute(new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MissingResponsibilityDocumentError);
    expect((error as MissingResponsibilityDocumentError).code).toBe('MISSING_RESPONSIBILITY_DOCUMENT');
    expect((error as MissingResponsibilityDocumentError).httpStatus).toBe(422);
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('tercero sin relación con el titular (EX-DEV-001) -> 422 MISSING_RESPONSIBILITY_DOCUMENT', async () => {
    const { deps, handler } = build();
    await expect(
      handler.execute(
        new CompleteInspectionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 5, false, undefined, undefined, {
          ...DOC,
          signerIsHolder: false,
        }),
      ),
    ).rejects.toThrow(MissingResponsibilityDocumentError);
    expect(deps.returns.update).not.toHaveBeenCalled();
  });
});
