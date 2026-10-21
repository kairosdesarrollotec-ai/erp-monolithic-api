import { NotFoundException } from '@nestjs/common';
import { RentalEvidenceRemovalService } from './rental-evidence-removal.service';
import { RentalStateConflictError } from '../../domain/rental-errors';

const SCOPE = { organizationId: 'o', operatingCompanyId: 'c', branchId: 'b' };
function build(status = 'PENDING_DELIVERY', rental = true) {
  const evidence = {
    list: jest.fn().mockResolvedValue([{ id: 'ev-1', rentalId: 'r', type: 'PHOTO', zone: 'FRONT', objectUrl: 'u', uploadedBy: 'x', uploadedAt: new Date() }]),
    delete: jest.fn().mockResolvedValue(true),
  };
  const rentals = { findById: jest.fn().mockResolvedValue(rental ? { id: 'r', status } : null) };
  return { evidence, rentals, service: new RentalEvidenceRemovalService(evidence as never, rentals as never) };
}

describe('RentalEvidenceRemovalService (regla unica compartida por el borrado directo y la doble aprobacion)', () => {
  it('locate devuelve el registro (foto fija) solo con el alquiler en PENDING_DELIVERY', async () => {
    const { service } = build();
    await expect(service.locate('r', 'ev-1', SCOPE)).resolves.toMatchObject({ id: 'ev-1', zone: 'FRONT' });
    await expect(build('ACTIVE').service.locate('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(RentalStateConflictError);
    await expect(build('PENDING_DELIVERY', false).service.locate('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.locate('r', 'otro', SCOPE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove borra dentro del tx recibido; estado/inexistente -> mismos errores y no borra', async () => {
    const { service, evidence } = build();
    const tx = { t: 1 } as never;
    await service.remove('r', 'ev-1', SCOPE, tx);
    expect(evidence.delete).toHaveBeenCalledWith('r', 'ev-1', SCOPE, tx);
    const done = build('ACTIVE');
    await expect(done.service.remove('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(RentalStateConflictError);
    expect(done.evidence.delete).not.toHaveBeenCalled();
    const gone = build();
    gone.evidence.delete.mockResolvedValue(false);
    await expect(gone.service.remove('r', 'ev-1', SCOPE)).rejects.toBeInstanceOf(NotFoundException);
  });
});
