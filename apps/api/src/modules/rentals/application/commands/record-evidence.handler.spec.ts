import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecordEvidenceHandler } from './record-evidence.handler';
import { RecordEvidenceCommand } from './record-evidence.command';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

function buildEvidencePort() {
  return {
    record: jest.fn().mockResolvedValue({
      id: 'ev-1',
      rentalId: 'rent-1',
      type: 'PHOTO',
      zone: 'FRONTAL',
      objectUrl: 'https://storage.googleapis.com/bucket/rental-evidence/x.jpg',
      uploadedBy: 'uid-1',
      uploadedAt: new Date(),
    }),
    countByType: jest.fn(),
    list: jest.fn(),
  };
}

function buildRentalsPort(status = 'PENDING_DELIVERY') {
  return { findById: jest.fn().mockResolvedValue({ id: 'rent-1', status }) };
}

function buildWorkContext() {
  return {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'comp-1',
      branchId: 'branch-1',
      ...testRole('FRONT_OFFICE'),
    }),
  };
}

function buildMatrixAuth() {
  return { assertAllowed: jest.fn().mockResolvedValue(undefined) };
}

describe('RecordEvidenceHandler', () => {
  it('registra la evidencia cuando objectUrl es de GCS y el alquiler esta PENDING_DELIVERY', async () => {
    const evidence = buildEvidencePort();
    const rentals = buildRentalsPort();
    const handler = new RecordEvidenceHandler(evidence as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    const result = await handler.execute(
      new RecordEvidenceCommand(
        'rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL',
        'https://storage.googleapis.com/bucket/rental-evidence/rent-1/photo/frontal/uuid.jpg',
      ),
    );

    expect(evidence.record).toHaveBeenCalledWith({
      rentalId: 'rent-1',
      scope: { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' },
      type: 'PHOTO',
      zone: 'FRONTAL',
      objectUrl: 'https://storage.googleapis.com/bucket/rental-evidence/rent-1/photo/frontal/uuid.jpg',
      uploadedBy: 'uid-1',
    });
    expect(result.id).toBe('ev-1');
  });

  it('rechaza con BadRequestException si objectUrl no es de GCS', async () => {
    const evidence = buildEvidencePort();
    const rentals = buildRentalsPort();
    const handler = new RecordEvidenceHandler(evidence as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RecordEvidenceCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'https://evil.example.com/x.jpg'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(evidence.record).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si el alquiler no existe', async () => {
    const evidence = buildEvidencePort();
    const rentals = { findById: jest.fn().mockResolvedValue(null) };
    const handler = new RecordEvidenceHandler(evidence as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RecordEvidenceCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'https://storage.googleapis.com/bucket/x.jpg'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza RentalStateConflictError si el alquiler no esta en PENDING_DELIVERY', async () => {
    const evidence = buildEvidencePort();
    const rentals = buildRentalsPort('ACTIVE');
    const handler = new RecordEvidenceHandler(evidence as any, rentals as any, buildWorkContext() as any, buildMatrixAuth() as any);

    await expect(
      handler.execute(
        new RecordEvidenceCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'FRONTAL', 'https://storage.googleapis.com/bucket/x.jpg'),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('ENTREGA-02: la foto ALCOHOL_TEST se registra en VALIDATION y no en PENDING_DELIVERY', async () => {
    const mk = (status: string) => ({
      evidence: { record: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
      handler: undefined as any,
      status,
    });
    const ok = mk('VALIDATION');
    ok.handler = new RecordEvidenceHandler(ok.evidence as any, buildRentalsPort('VALIDATION') as any, buildWorkContext() as any, buildMatrixAuth() as any);
    const cmd = new RecordEvidenceCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'ALCOHOL_TEST' as any, 'https://storage.googleapis.com/bucket/a.jpg');
    await expect(ok.handler.execute(cmd)).resolves.toBeDefined();
    expect(ok.evidence.record).toHaveBeenCalledWith(expect.objectContaining({ zone: 'ALCOHOL_TEST' }));

    const bad = mk('PENDING_DELIVERY');
    bad.handler = new RecordEvidenceHandler(bad.evidence as any, buildRentalsPort('PENDING_DELIVERY') as any, buildWorkContext() as any, buildMatrixAuth() as any);
    await expect(bad.handler.execute(cmd)).rejects.toThrow(RentalStateConflictError);
  });
});
