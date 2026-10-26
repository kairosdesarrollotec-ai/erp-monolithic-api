import { ForbiddenException } from '@nestjs/common';
import { PublishHrDocumentHandler } from './publish-hr-document.handler';
import { PublishHrDocumentCommand } from './publish-hr-document.command';
import { HrDocumentRepositoryPort } from '../ports/hr-document-repository.port';
import { InvalidHrDocumentCategoryError } from '../../domain/hr-document-errors';
import { buildMatrixAuth, buildWorkContext } from '../../testing/hr-administration-test-fixtures';

class MockHrDocumentRepository implements Partial<HrDocumentRepositoryPort> {
  docs: any[] = [];

  async publishVersion(data: any): Promise<any> {
    let doc = this.docs.find(
      (d) => d.operatingCompanyId === data.operatingCompanyId && d.code === data.code,
    );

    if (!doc) {
      doc = {
        id: `doc-${this.docs.length + 1}`,
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        code: data.code,
        title: data.title,
        category: data.category,
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [],
      };
      this.docs.push(doc);
    } else {
      doc.title = data.title;
      doc.category = data.category;
      doc.updatedAt = new Date();
      for (const v of doc.versions) {
        v.isCurrent = false;
      }
    }

    const versionNum = doc.versions.length + 1;
    const versionRecord = {
      id: `ver-${doc.id}-${versionNum}`,
      documentId: doc.id,
      version: versionNum,
      fileUrl: data.fileUrl,
      fileHash: data.fileHash ?? null,
      fileName: data.fileName ?? null,
      mimeType: data.mimeType ?? 'application/pdf',
      sizeBytes: data.sizeBytes ?? null,
      isCurrent: true,
      publishedBy: data.publishedBy,
      publishedAt: new Date(),
      createdAt: new Date(),
    };
    doc.versions.push(versionRecord);

    return {
      ...doc,
      currentVersion: versionRecord,
    };
  }
}

describe('PublishHrDocumentHandler (HU-31)', () => {
  let handler: PublishHrDocumentHandler;
  let repo: MockHrDocumentRepository;
  let audit: { recordHrAdministrationEvent: jest.Mock };
  let outbox: { publish: jest.Mock };
  let txManager: { run: jest.Mock };

  beforeEach(() => {
    repo = new MockHrDocumentRepository();
    audit = { recordHrAdministrationEvent: jest.fn().mockResolvedValue(undefined) };
    outbox = { publish: jest.fn().mockResolvedValue(undefined) };
    txManager = { run: jest.fn().mockImplementation((fn) => fn({})) };

    const workContext = buildWorkContext('GERENCIA');
    const matrixAuth = buildMatrixAuth();

    handler = new PublishHrDocumentHandler(
      repo as any,
      workContext,
      matrixAuth,
      audit as any,
      outbox as any,
      txManager as any,
    );
  });

  it('Gerencia publica un nuevo documento version 1 con isCurrent=true', async () => {
    const result = await handler.execute(
      new PublishHrDocumentCommand(
        'uid-gerencia',
        'comp-1',
        'branch-1',
        'RIT-001',
        'Reglamento Interno de Trabajo',
        'REGULATION',
        'https://storage.test/rit-v1.pdf',
      ),
    );

    expect(result.code).toBe('RIT-001');
    expect(result.currentVersion.version).toBe(1);
    expect(result.currentVersion.isCurrent).toBe(true);
    expect(audit.recordHrAdministrationEvent).toHaveBeenCalledTimes(1);
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'HrDocumentPublished.v1',
        aggregateId: result.id,
      }),
      expect.anything(),
    );
  });

  it('Publicar una nueva versión del mismo código reemplaza la versión vigente e incrementa la versión a 2', async () => {
    // Version 1
    const v1 = await handler.execute(
      new PublishHrDocumentCommand(
        'uid-gerencia',
        'comp-1',
        'branch-1',
        'POL-SEG-01',
        'Política de Seguridad v1',
        'POLICY',
        'https://storage.test/pol-v1.pdf',
      ),
    );
    expect(v1.currentVersion.version).toBe(1);
    expect(v1.currentVersion.isCurrent).toBe(true);

    // Version 2
    const v2 = await handler.execute(
      new PublishHrDocumentCommand(
        'uid-gerencia',
        'comp-1',
        'branch-1',
        'POL-SEG-01',
        'Política de Seguridad v2',
        'POLICY',
        'https://storage.test/pol-v2.pdf',
      ),
    );
    expect(v2.id).toBe(v1.id);
    expect(v2.currentVersion.version).toBe(2);
    expect(v2.currentVersion.isCurrent).toBe(true);

    const docInRepo = repo.docs.find((d) => d.id === v1.id);
    expect(docInRepo.versions).toHaveLength(2);
    expect(docInRepo.versions[0].isCurrent).toBe(false);
    expect(docInRepo.versions[1].isCurrent).toBe(true);
  });

  it('Rechaza categorías no permitidas con InvalidHrDocumentCategoryError', async () => {
    await expect(
      handler.execute(
        new PublishHrDocumentCommand(
          'uid-gerencia',
          'comp-1',
          'branch-1',
          'DOC-99',
          'Documento Invalido',
          'INVALID_CAT',
          'https://storage.test/doc.pdf',
        ),
      ),
    ).rejects.toThrow(InvalidHrDocumentCategoryError);
  });

  it('Deniega la publicación a un rol sin permiso (CAMPO)', async () => {
    const campoWorkContext = buildWorkContext('CAMPO');
    const campoHandler = new PublishHrDocumentHandler(
      repo as any,
      campoWorkContext,
      buildMatrixAuth(),
      audit as any,
      outbox as any,
      txManager as any,
    );

    await expect(
      campoHandler.execute(
        new PublishHrDocumentCommand(
          'uid-campo',
          'comp-1',
          'branch-1',
          'FOR-01',
          'Formato',
          'FORMAT',
          'https://storage.test/for.pdf',
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
