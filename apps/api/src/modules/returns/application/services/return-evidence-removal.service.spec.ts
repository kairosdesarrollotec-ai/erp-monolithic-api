import { ReturnEvidenceRemovalService } from './return-evidence-removal.service';
import { ReturnEvidenceNotFoundError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';

const SCOPE = { organizationId: 'o', operatingCompanyId: 'c', branchId: 'b' };
function build(status = 'INSPECCION', found = true) {
  const returns = {
    findById: jest.fn().mockResolvedValue(found ? { id: 'r', status } : null),
    listEvidences: jest.fn().mockResolvedValue([{ id: 'ev-1', type: 'PHOTO', zone: 'Z', objectUrl: 'u', uploadedBy: 'x', uploadedAt: new Date() }]),
    deleteEvidence: jest.fn().mockResolvedValue(true),
  };
  return { returns, service: new ReturnEvidenceRemovalService(returns as never) };
}

describe('ReturnEvidenceRemovalService (regla unica compartida por el borrado directo y la doble aprobacion)', () => {
  it('locate: estados que admiten evidencia; devolucion o evidencia inexistente', async () => {
    await expect(build().service.locate('r', 'ev-1', SCOPE)).resolves.toMatchObject({ id: 'ev-1' });
    await expect(build('CERRADA').service.locate('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(ReturnStateConflictError);
    await expect(build('INSPECCION', false).service.locate('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(ReturnNotFoundError);
    await expect(build().service.locate('r', 'otro', SCOPE)).rejects.toBeInstanceOf(ReturnEvidenceNotFoundError);
  });

  it('remove borra dentro del tx recibido y respeta el estado', async () => {
    const { service, returns } = build();
    const tx = { t: 1 } as never;
    await service.remove('r', 'ev-1', SCOPE, tx);
    expect(returns.deleteEvidence).toHaveBeenCalledWith('r', 'ev-1', SCOPE, tx);
    const closed = build('PROGRAMADA');
    await expect(closed.service.remove('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(ReturnStateConflictError);
    expect(closed.returns.deleteEvidence).not.toHaveBeenCalled();
  });
});
