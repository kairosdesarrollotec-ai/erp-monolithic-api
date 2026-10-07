import { ForbiddenException } from '@nestjs/common';
import { RequestReturnEvidenceUploadSessionHandler } from './request-return-evidence-upload-session.handler';
import { RequestReturnEvidenceUploadSessionCommand } from './request-return-evidence-upload-session.command';
import { RecordReturnEvidenceHandler } from './record-return-evidence.handler';
import { RecordReturnEvidenceCommand } from './record-return-evidence.command';
import { ReturnEvidenceStoragePort } from '../ports/return-evidence-storage.port';
import {
  InvalidReturnEvidenceError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { buildDeps, buildReturnRecord } from '../../testing/return-test-fixtures';

describe('Evidencia de devolución (TR-08 / BR-DEV-009)', () => {
  const expiresAt = new Date('2026-10-05T12:15:00.000Z');

  function buildUpload(role: 'CAMPO' | 'FINANZAS' = 'CAMPO', status: Parameters<typeof buildReturnRecord>[0] = { status: 'INSPECCION' }) {
    const deps = buildDeps({ role });
    deps.returns.findById.mockResolvedValue(buildReturnRecord(status));
    const storage: jest.Mocked<ReturnEvidenceStoragePort> = {
      generateSignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://signed.example/upload',
        objectUrl: 'https://storage.googleapis.com/bucket/companies/comp-1/returns/ret-1/photo_capot_1.jpg',
        expiresAt,
      }),
    };
    return { deps, storage, handler: new RequestReturnEvidenceUploadSessionHandler(deps.access, deps.returns, storage) };
  }

  const upload = (type: 'PHOTO' | 'VIDEO', contentType: 'image/jpeg' | 'video/mp4', length: number) =>
    new RequestReturnEvidenceUploadSessionCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', type, 'capot', contentType, length);

  describe('request upload session', () => {
    it('devuelve la URL firmada con su expiración', async () => {
      const { storage, handler } = buildUpload();
      const session = await handler.execute(upload('PHOTO', 'image/jpeg', 1_000_000));
      expect(session.expiresAt).toBe(expiresAt);
      expect(storage.generateSignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'comp-1', returnId: 'ret-1', type: 'PHOTO', zone: 'capot', contentType: 'image/jpeg' }),
      );
    });

    it('PHOTO con contentType de video, o foto mayor a 12 MB -> InvalidReturnEvidenceError', async () => {
      const { storage, handler } = buildUpload();
      await expect(handler.execute(upload('PHOTO', 'video/mp4', 1000))).rejects.toThrow(InvalidReturnEvidenceError);
      await expect(handler.execute(upload('PHOTO', 'image/jpeg', 13 * 1024 * 1024))).rejects.toThrow(InvalidReturnEvidenceError);
      expect(storage.generateSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('VIDEO hasta 50 MB permitido; VIDEO con imagen rechazado', async () => {
      const { handler } = buildUpload();
      await expect(handler.execute(upload('VIDEO', 'video/mp4', 50 * 1024 * 1024))).resolves.toBeDefined();
      await expect(handler.execute(upload('VIDEO', 'image/jpeg', 1000))).rejects.toThrow(InvalidReturnEvidenceError);
    });

    it('estado que no admite evidencia (PROGRAMADA/CERRADA) -> ReturnStateConflictError', async () => {
      for (const status of ['PROGRAMADA', 'CERRADA'] as const) {
        const { handler } = buildUpload('CAMPO', { status });
        await expect(handler.execute(upload('PHOTO', 'image/jpeg', 1000))).rejects.toThrow(ReturnStateConflictError);
      }
    });

    it('devolución inexistente -> ReturnNotFoundError; rol FINANZAS no puede subir evidencia', async () => {
      const missing = buildUpload();
      missing.deps.returns.findById.mockResolvedValue(null);
      await expect(missing.handler.execute(upload('PHOTO', 'image/jpeg', 1000))).rejects.toThrow(ReturnNotFoundError);

      const forbidden = buildUpload('FINANZAS');
      await expect(forbidden.handler.execute(upload('PHOTO', 'image/jpeg', 1000))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('record evidence', () => {
    const goodUrl = 'https://storage.googleapis.com/bucket/companies/comp-1/returns/ret-1/photo_capot_1.jpg';
    const record = (objectUrl: string) =>
      new RecordReturnEvidenceCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 'PHOTO', 'capot', objectUrl);

    function buildRecord(status: Parameters<typeof buildReturnRecord>[0] = { status: 'INSPECCION' }) {
      const deps = buildDeps({ role: 'CAMPO' });
      deps.returns.findById.mockResolvedValue(buildReturnRecord(status));
      deps.returns.addEvidence.mockImplementation(async (input) => ({ id: 'ev-1', ...input, uploadedAt: new Date('2026-10-05T12:00:00Z') }));
      return { deps, handler: new RecordReturnEvidenceHandler(deps.access, deps.returns) };
    }

    it('registra la evidencia con organización del contexto y el uploader', async () => {
      const { deps, handler } = buildRecord();
      const saved = await handler.execute(record(goodUrl));
      expect(saved.id).toBe('ev-1');
      expect(deps.returns.addEvidence).toHaveBeenCalledWith({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        returnId: 'ret-1',
        type: 'PHOTO',
        zone: 'capot',
        objectUrl: goodUrl,
        uploadedBy: 'uid-1',
      });
    });

    it('rechaza URLs que no son de GCS o que pertenecen a otra devolución/empresa', async () => {
      const { deps, handler } = buildRecord();
      await expect(handler.execute(record('https://evil.example/x.jpg'))).rejects.toThrow(InvalidReturnEvidenceError);
      await expect(
        handler.execute(record('https://storage.googleapis.com/bucket/companies/comp-1/returns/OTRA/photo.jpg')),
      ).rejects.toThrow(InvalidReturnEvidenceError);
      await expect(
        handler.execute(record('https://storage.googleapis.com/bucket/companies/comp-2/returns/ret-1/photo.jpg')),
      ).rejects.toThrow(InvalidReturnEvidenceError);
      expect(deps.returns.addEvidence).not.toHaveBeenCalled();
    });

    it('estado SIN_DANOS no admite más evidencia', async () => {
      const { handler } = buildRecord({ status: 'SIN_DANOS' });
      await expect(handler.execute(record(goodUrl))).rejects.toThrow(ReturnStateConflictError);
    });
  });
});
