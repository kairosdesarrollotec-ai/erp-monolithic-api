import { GetExpectationDocumentHandler } from './get-expectation-document.handler';
import { GetExpectationDocumentQuery } from './get-expectation-document.query';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { buildWorkContext } from '../../testing/hr-administration-test-fixtures';

describe('GetExpectationDocumentHandler (REC-P13, BDD-05, BDD-00)', () => {
  let handler: GetExpectationDocumentHandler;
  let access: any;
  let employeeRepo: any;
  let expectationRepo: any;

  const mockEmployee = {
    id: 'emp-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    fullName: 'Ana Torres',
    candidateId: 'cand-1',
    hireDate: new Date('2026-10-20T00:00:00.000Z'),
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    updatedAt: new Date('2026-10-20T00:00:00.000Z'),
  };

  beforeEach(() => {
    access = {
      authorize: jest.fn().mockResolvedValue({
        context: buildWorkContext({ role: 'GERENCIA', companyId: 'comp-1', branchId: 'branch-1' }),
      }),
    };

    employeeRepo = {
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === 'emp-1') return Promise.resolve(mockEmployee);
        return Promise.resolve(null);
      }),
    };

    expectationRepo = {
      findByEmployeeId: jest.fn().mockResolvedValue(null),
    };

    handler = new GetExpectationDocumentHandler(access, employeeRepo, expectationRepo);
  });

  it('devuelve estado PENDIENTE, deadline calculado (hireDate + 2 días) e isOverdue: true si ya venció', async () => {
    // hireDate = 2026-10-20 -> deadline = 2026-10-22. Si hoy es después del 22, isOverdue es true.
    const result = await handler.execute(new GetExpectationDocumentQuery('emp-1', 'user-1'));

    expect(access.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'user-1', companyId: 'comp-1' }),
      'VIEW_EMPLOYEES',
    );

    expect(result.status).toBe('PENDIENTE');
    expect(result.deadlineDate).toBe('2026-10-22');
    expect(result.isOverdue).toBe(true);
    expect(result.fileUrl).toBeNull();
  });

  it('devuelve documento existente con estado FIRMADO e isOverdue: false', async () => {
    expectationRepo.findByEmployeeId.mockResolvedValue({
      id: 'doc-123',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      employeeId: 'emp-1',
      status: 'FIRMADO',
      deadlineDate: new Date('2026-10-22T00:00:00.000Z'),
      fileUrl: 'https://storage.kairos.pe/expectations/signed.pdf',
      signedAt: new Date('2026-10-21T15:00:00.000Z'),
      registeredBy: 'RECLUTAMIENTO',
      signedRegisteredBy: 'user-rrhh',
      notes: null,
      createdAt: new Date('2026-10-20T10:00:00.000Z'),
      updatedAt: new Date('2026-10-21T15:00:00.000Z'),
    });

    const result = await handler.execute(new GetExpectationDocumentQuery('emp-1', 'user-1'));

    expect(result.status).toBe('FIRMADO');
    expect(result.isOverdue).toBe(false);
    expect(result.fileUrl).toBe('https://storage.kairos.pe/expectations/signed.pdf');
    expect(result.signedRegisteredBy).toBe('user-rrhh');
  });

  it('lanza EmployeeNotFoundError si el colaborador no existe', async () => {
    await expect(
      handler.execute(new GetExpectationDocumentQuery('bad-id', 'user-1')),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});
