import { RecordExpectationDocumentHandler } from './record-expectation-document.handler';
import { RecordExpectationDocumentCommand } from './record-expectation-document.command';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { buildWorkContext } from '../../testing/hr-administration-test-fixtures';

describe('RecordExpectationDocumentHandler (REC-P13, BDD-05, BDD-00)', () => {
  let handler: RecordExpectationDocumentHandler;
  let access: any;
  let employeeRepo: any;
  let expectationRepo: any;
  let txManager: any;
  let auditRepo: any;
  let outboxRepo: any;

  const mockEmployee = {
    id: 'emp-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    fullName: 'Carlos Rojas',
    candidateId: 'cand-1',
    hireDate: new Date('2026-10-24T00:00:00.000Z'),
    createdAt: new Date('2026-10-24T00:00:00.000Z'),
    updatedAt: new Date('2026-10-24T00:00:00.000Z'),
  };

  beforeEach(() => {
    access = {
      authorize: jest.fn().mockResolvedValue({
        context: buildWorkContext({ role: 'RRHH', companyId: 'comp-1', branchId: 'branch-1' }),
      }),
    };

    employeeRepo = {
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === 'emp-1') return Promise.resolve(mockEmployee);
        return Promise.resolve(null);
      }),
    };

    expectationRepo = {
      upsert: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({
          id: 'exp-doc-1',
          ...data,
          createdAt: new Date('2026-10-26T10:00:00.000Z'),
          updatedAt: new Date('2026-10-26T10:00:00.000Z'),
        }),
      ),
    };

    txManager = {
      run: jest.fn().mockImplementation(async (cb: (tx: any) => any) => cb({})),
    };

    auditRepo = {
      recordHrAdministrationEvent: jest.fn().mockResolvedValue(undefined),
    };

    outboxRepo = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    handler = new RecordExpectationDocumentHandler(
      access,
      employeeRepo,
      expectationRepo,
      txManager,
      auditRepo,
      outboxRepo,
    );
  });

  it('registra el documento de expectativas firmado, calcula deadline a 2 días de hireDate, audita y publica outbox', async () => {
    const signedAt = new Date('2026-10-26T09:30:00.000Z');
    const cmd = new RecordExpectationDocumentCommand(
      'emp-1',
      'user-rrhh-1',
      'https://storage.kairos.pe/expectations/doc-carlos.pdf',
      signedAt,
      'Firmado conforme por el colaborador',
    );

    const result = await handler.execute(cmd);

    expect(access.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'user-rrhh-1', companyId: 'comp-1' }),
      'MANAGE_EXPECTATION_DOCUMENT',
    );

    expect(expectationRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        status: 'FIRMADO',
        deadlineDate: new Date('2026-10-26T00:00:00.000Z'), // hireDate (24th) + 2 days = 26th
        fileUrl: 'https://storage.kairos.pe/expectations/doc-carlos.pdf',
        signedAt,
        signedRegisteredBy: 'user-rrhh-1',
        notes: 'Firmado conforme por el colaborador',
      }),
      expect.anything(),
    );

    expect(auditRepo.recordHrAdministrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_EXPECTATION_DOCUMENT_RECORDED',
        entityType: 'hr_document',
        changes: expect.objectContaining({
          employeeId: 'emp-1',
          status: 'FIRMADO',
          fileUrl: 'https://storage.kairos.pe/expectations/doc-carlos.pdf',
        }),
      }),
      expect.anything(),
    );

    expect(outboxRepo.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DocumentoExpectativasRegistrado.v1',
        payload: expect.objectContaining({
          employeeId: 'emp-1',
          employeeName: 'Carlos Rojas',
        }),
      }),
      expect.anything(),
    );

    expect(result.status).toBe('FIRMADO');
    expect(result.deadlineDate).toBe('2026-10-26');
    expect(result.isOverdue).toBe(false);
    expect(result.fileUrl).toBe('https://storage.kairos.pe/expectations/doc-carlos.pdf');
  });

  it('si el empleado no existe lanza EmployeeNotFoundError', async () => {
    await expect(
      handler.execute(
        new RecordExpectationDocumentCommand('bad-emp', 'user-1', 'https://file.pdf'),
      ),
    ).rejects.toThrow(EmployeeNotFoundError);
  });
});
