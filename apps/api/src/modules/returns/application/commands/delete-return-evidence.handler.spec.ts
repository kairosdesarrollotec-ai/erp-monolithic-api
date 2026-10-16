import { ForbiddenException } from '@nestjs/common';
import { DeleteReturnEvidenceHandler } from './delete-return-evidence.handler';
import { DeleteReturnEvidenceCommand } from './delete-return-evidence.command';
import {
  ReturnEvidenceNotFoundError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { buildDeps, buildReturnRecord, TEST_SCOPE } from '../../testing/return-test-fixtures';

describe('DeleteReturnEvidenceHandler (DEV-04)', () => {
  function build(role: 'CAMPO' | 'FINANZAS' = 'CAMPO', status: Parameters<typeof buildReturnRecord>[0] = { status: 'INSPECCION' }) {
    const deps = buildDeps({ role });
    deps.returns.findById.mockResolvedValue(buildReturnRecord(status));
    deps.returns.deleteEvidence.mockResolvedValue(true);
    return { deps, handler: new DeleteReturnEvidenceHandler(deps.access, deps.returns) };
  }
  const cmd = () => new DeleteReturnEvidenceCommand('ret-1', 'ev-1', 'uid-1', 'comp-1', 'branch-1');

  it('elimina la evidencia en un estado que admite evidencia', async () => {
    for (const status of ['RECEPCION_PROVISIONAL', 'INSPECCION', 'CON_DANOS'] as const) {
      const { deps, handler } = build('CAMPO', { status });
      await handler.execute(cmd());
      expect(deps.returns.deleteEvidence).toHaveBeenCalledWith('ret-1', 'ev-1', TEST_SCOPE);
    }
  });

  it('devolucion cerrada o programada -> ReturnStateConflictError y no borra', async () => {
    for (const status of ['PROGRAMADA', 'CERRADA'] as const) {
      const { deps, handler } = build('CAMPO', { status });
      await expect(handler.execute(cmd())).rejects.toThrow(ReturnStateConflictError);
      expect(deps.returns.deleteEvidence).not.toHaveBeenCalled();
    }
  });

  it('devolucion inexistente -> ReturnNotFoundError; evidencia inexistente -> ReturnEvidenceNotFoundError', async () => {
    const missing = build();
    missing.deps.returns.findById.mockResolvedValue(null);
    await expect(missing.handler.execute(cmd())).rejects.toThrow(ReturnNotFoundError);

    const noEvidence = build();
    noEvidence.deps.returns.deleteEvidence.mockResolvedValue(false);
    await expect(noEvidence.handler.execute(cmd())).rejects.toThrow(ReturnEvidenceNotFoundError);
  });

  it('rol FINANZAS no puede eliminar evidencia (misma accion que subirla)', async () => {
    const { handler } = build('FINANZAS');
    await expect(handler.execute(cmd())).rejects.toThrow(ForbiddenException);
  });
});
