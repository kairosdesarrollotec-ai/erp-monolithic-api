import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteEvidenceHandler } from './delete-evidence.handler';
import { DeleteEvidenceCommand } from './delete-evidence.command';
import { RentalEvidenceRemovalService } from '../services/rental-evidence-removal.service';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

function build(status = 'PENDING_DELIVERY', removed = true, rentalExists = true) {
  const evidence = { delete: jest.fn().mockResolvedValue(removed) };
  const rentals = { findById: jest.fn().mockResolvedValue(rentalExists ? { id: 'rent-1', status } : null) };
  const workContext = {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'comp-1',
      branchId: 'branch-1',
      ...testRole('FRONT_OFFICE'),
    }),
  };
  const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
  const removal = new RentalEvidenceRemovalService(evidence as any, rentals as any);
  const handler = new DeleteEvidenceHandler(removal, workContext as any, matrixAuth as any);
  return { evidence, rentals, matrixAuth, handler };
}

const cmd = () => new DeleteEvidenceCommand('rent-1', 'ev-1', 'uid-1', 'comp-1', 'branch-1');

describe('DeleteEvidenceHandler', () => {
  it('elimina la evidencia dentro del scope cuando el alquiler esta PENDING_DELIVERY', async () => {
    const { evidence, matrixAuth, handler } = build();
    await handler.execute(cmd());
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', expect.anything(), 'EVIDENCE', 'DELETE_DIRECT', {
      companyId: 'comp-1',
      branchId: 'branch-1',
    });
    expect(evidence.delete).toHaveBeenCalledWith(
      'rent-1',
      'ev-1',
      { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' },
      undefined,
    );
  });

  it('sin EVIDENCE.DELETE_DIRECT (borrado directo DEPRECADO) -> rechaza y no borra', async () => {
    const { evidence, matrixAuth, handler } = build();
    matrixAuth.assertAllowed.mockRejectedValueOnce(new ForbiddenException());
    await expect(handler.execute(cmd())).rejects.toThrow(ForbiddenException);
    expect(evidence.delete).not.toHaveBeenCalled();
  });

  it('alquiler inexistente -> NotFoundException y no borra', async () => {
    const { evidence, handler } = build('PENDING_DELIVERY', true, false);
    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    expect(evidence.delete).not.toHaveBeenCalled();
  });

  it('entrega ya completada (ACTIVE) -> RentalStateConflictError y no borra', async () => {
    const { evidence, handler } = build('ACTIVE');
    await expect(handler.execute(cmd())).rejects.toThrow(RentalStateConflictError);
    expect(evidence.delete).not.toHaveBeenCalled();
  });

  it('evidencia inexistente o de otro alquiler/empresa -> NotFoundException', async () => {
    const { handler } = build('PENDING_DELIVERY', false);
    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
  });
});
