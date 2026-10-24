import { ListActiveHrDocumentsHandler } from './list-active-hr-documents.handler';
import { ListActiveHrDocumentsQuery } from './list-active-hr-documents.query';
import { HrDocumentRepositoryPort } from '../ports/hr-document-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { buildMatrixAuth, buildWorkContext } from '../../testing/hr-administration-test-fixtures';

describe('ListActiveHrDocumentsHandler (HU-31)', () => {
  let handler: ListActiveHrDocumentsHandler;
  let repo: Partial<HrDocumentRepositoryPort>;
  let employeeRepo: Partial<EmployeeRepositoryPort>;

  const mockDocs = [
    {
      id: 'doc-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      code: 'RIT-001',
      title: 'Reglamento Interno',
      category: 'REGULATION',
      createdAt: new Date('2026-10-01'),
      updatedAt: new Date('2026-10-01'),
      currentVersion: {
        id: 'ver-1',
        documentId: 'doc-1',
        version: 1,
        fileUrl: 'https://test/rit.pdf',
        fileHash: null,
        fileName: 'rit.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        isCurrent: true,
        publishedBy: 'uid-gerencia',
        publishedAt: new Date('2026-10-01'),
        createdAt: new Date('2026-10-01'),
      },
    },
    {
      id: 'doc-2',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      code: 'POL-001',
      title: 'Política de Privacidad',
      category: 'POLICY',
      createdAt: new Date('2026-10-02'),
      updatedAt: new Date('2026-10-02'),
      currentVersion: {
        id: 'ver-2',
        documentId: 'doc-2',
        version: 2,
        fileUrl: 'https://test/pol.pdf',
        fileHash: null,
        fileName: 'pol.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        isCurrent: true,
        publishedBy: 'uid-gerencia',
        publishedAt: new Date('2026-10-02'),
        createdAt: new Date('2026-10-02'),
      },
    },
  ];

  beforeEach(() => {
    repo = {
      listActive: jest.fn().mockImplementation((comp, cat) => {
        return Promise.resolve(cat ? mockDocs.filter((d) => d.category === cat) : mockDocs);
      }),
      findReadsByEmployee: jest.fn().mockResolvedValue([
        { documentVersionId: 'ver-1', employeeId: 'emp-1', readAt: new Date('2026-10-05') },
      ]),
    };

    employeeRepo = {
      findByFirebaseUid: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    };

    const workContext = buildWorkContext('CAMPO');
    const matrixAuth = buildMatrixAuth();

    handler = new ListActiveHrDocumentsHandler(
      repo as any,
      employeeRepo as any,
      workContext,
      matrixAuth,
    );
  });

  it('Lista documentos activos e informa el estado de lectura del colaborador', async () => {
    const result = await handler.execute(
      new ListActiveHrDocumentsQuery('uid-campo', 'comp-1'),
    );

    expect(result.total).toBe(2);
    expect(result.items[0].code).toBe('RIT-001');
    expect(result.items[0].hasRead).toBe(true);
    expect(result.items[0].readAt).toBe('2026-10-05T00:00:00.000Z');

    expect(result.items[1].code).toBe('POL-001');
    expect(result.items[1].hasRead).toBe(false);
    expect(result.items[1].readAt).toBeNull();
  });

  it('Filtra por categoría cuando se especifica', async () => {
    const result = await handler.execute(
      new ListActiveHrDocumentsQuery('uid-campo', 'comp-1', 'POLICY'),
    );

    expect(result.total).toBe(1);
    expect(result.items[0].code).toBe('POL-001');
  });

  it('Cuando se publica una nueva versión de un documento leído previamente, la nueva versión vigente figura como no leída', async () => {
    // Si doc-1 ahora tiene como versión vigente la v2 (id 'ver-1-v2') y el colaborador solo confirmó 'ver-1'
    const docsWithNewVersion = [
      {
        ...mockDocs[0],
        currentVersion: {
          ...mockDocs[0].currentVersion,
          id: 'ver-1-v2',
          version: 2,
        },
      },
    ];
    (repo.listActive as jest.Mock).mockResolvedValue(docsWithNewVersion);

    const result = await handler.execute(
      new ListActiveHrDocumentsQuery('uid-campo', 'comp-1'),
    );

    expect(result.items[0].code).toBe('RIT-001');
    expect(result.items[0].version).toBe(2);
    expect(result.items[0].hasRead).toBe(false);
    expect(result.items[0].readAt).toBeNull();
  });
});

