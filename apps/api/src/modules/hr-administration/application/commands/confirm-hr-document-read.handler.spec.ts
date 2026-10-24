import { ConfirmHrDocumentReadHandler } from './confirm-hr-document-read.handler';
import { ConfirmHrDocumentReadCommand } from './confirm-hr-document-read.command';
import { HrDocumentRepositoryPort } from '../ports/hr-document-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  HrDocumentEmployeeNotFoundError,
  HrDocumentNotFoundError,
} from '../../domain/hr-document-errors';
import { buildMatrixAuth, buildWorkContext } from '../../testing/hr-administration-test-fixtures';

describe('ConfirmHrDocumentReadHandler (HU-31)', () => {
  let handler: ConfirmHrDocumentReadHandler;
  let repo: Partial<HrDocumentRepositoryPort>;
  let employeeRepo: Partial<EmployeeRepositoryPort>;
  let audit: { recordHrAdministrationEvent: jest.Mock };

  beforeEach(() => {
    repo = {
      findActiveById: jest.fn().mockImplementation((id, comp) => {
        if (id === 'doc-valid') {
          return Promise.resolve({
            id: 'doc-valid',
            organizationId: 'org-1',
            operatingCompanyId: comp,
            code: 'RIT-001',
            title: 'Reglamento Interno',
            category: 'REGULATION',
            createdAt: new Date(),
            updatedAt: new Date(),
            currentVersion: {
              id: 'ver-doc-1-1',
              documentId: 'doc-valid',
              version: 1,
              fileUrl: 'https://test/rit.pdf',
              fileHash: null,
              fileName: 'rit.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1024,
              isCurrent: true,
              publishedBy: 'uid-gerencia',
              publishedAt: new Date(),
              createdAt: new Date(),
            },
          });
        }
        return Promise.resolve(null);
      }),
      recordRead: jest.fn().mockResolvedValue({
        id: 'read-1',
        documentVersionId: 'ver-doc-1-1',
        employeeId: 'emp-1',
        readAt: new Date('2026-10-23T12:00:00Z'),
      }),
    };

    employeeRepo = {
      findByFirebaseUid: jest.fn().mockImplementation((comp, uid) => {
        if (uid === 'uid-colab') return Promise.resolve({ id: 'emp-1' });
        return Promise.resolve(null);
      }),
    };

    audit = { recordHrAdministrationEvent: jest.fn().mockResolvedValue(undefined) };

    const workContext = buildWorkContext('CAMPO');
    const matrixAuth = buildMatrixAuth();

    handler = new ConfirmHrDocumentReadHandler(
      repo as any,
      employeeRepo as any,
      workContext,
      matrixAuth,
      audit as any,
    );
  });

  it('Confirma la lectura de la versión vigente de un documento por el colaborador', async () => {
    const result = await handler.execute(
      new ConfirmHrDocumentReadCommand('uid-colab', 'doc-valid'),
    );

    expect(result.documentId).toBe('doc-valid');
    expect(result.employeeId).toBe('emp-1');
    expect(result.readAt).toBe('2026-10-23T12:00:00.000Z');
    expect(repo.recordRead).toHaveBeenCalledWith(
      expect.objectContaining({
        documentVersionId: 'ver-doc-1-1',
        employeeId: 'emp-1',
      }),
    );
    expect(audit.recordHrAdministrationEvent).toHaveBeenCalledTimes(1);
  });

  it('Lanza HrDocumentNotFoundError si el documento no existe o está inactivo', async () => {
    await expect(
      handler.execute(new ConfirmHrDocumentReadCommand('uid-colab', 'doc-nonexistent')),
    ).rejects.toThrow(HrDocumentNotFoundError);
  });

  it('Lanza HrDocumentEmployeeNotFoundError si el usuario no tiene ficha vinculada', async () => {
    await expect(
      handler.execute(new ConfirmHrDocumentReadCommand('uid-unlinked', 'doc-valid')),
    ).rejects.toThrow(HrDocumentEmployeeNotFoundError);
  });
});
