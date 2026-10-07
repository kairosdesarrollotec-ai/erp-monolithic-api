import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageError, LocalStorageService } from './local-storage.service';
import { LocalStorageTokenError } from './local-storage-token';

describe('LocalStorageService', () => {
  let dir: string;
  let service: LocalStorageService;

  const tokenOf = (url: string) => url.slice(url.lastIndexOf('/') + 1);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kairos-local-storage-'));
    service = new LocalStorageService({
      rootDir: dir,
      secret: 'secret',
      publicUrl: 'http://localhost:3000/',
      maxBytes: 10,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('genera URLs al propio API con el mismo formato que GCS', () => {
    const r = service.createUploadUrl('rental-evidence/c/r/x.jpg', 'image/jpeg');
    expect(r.uploadUrl).toMatch(/^http:\/\/localhost:3000\/dev-storage\/upload\/.+\..+$/);
    expect(r.objectUrl).toBe('http://localhost:3000/dev-storage/objects/rental-evidence/c/r/x.jpg');
    expect(r.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('escribe con token válido y luego lee por clave y por token de lectura', async () => {
    const { uploadUrl, objectUrl } = service.createUploadUrl('a/b/foto.jpg', 'image/jpeg');
    await service.writeWithToken(tokenOf(uploadUrl), Buffer.from('hola'), 'image/jpeg');

    const byKey = await service.readByKey('a/b/foto.jpg');
    expect(byKey.data.toString()).toBe('hola');
    expect(byKey.contentType).toBe('image/jpeg');

    const readUrl = service.createReadUrl(objectUrl);
    expect(readUrl).toContain('/dev-storage/files/');
    const byToken = await service.readWithToken(tokenOf(readUrl));
    expect(byToken.data.toString()).toBe('hola');
  });

  it('createReadUrl devuelve tal cual una URL que no es local', () => {
    expect(service.createReadUrl('https://storage.googleapis.com/b/k.jpg')).toBe(
      'https://storage.googleapis.com/b/k.jpg',
    );
  });

  it('rechaza token inválido o expirado', async () => {
    const { uploadUrl } = service.createUploadUrl('a/x.jpg', 'image/jpeg', 1000, 0);
    await expect(service.writeWithToken(tokenOf(uploadUrl), Buffer.from('x'), 'image/jpeg', 5000)).rejects.toThrow(
      LocalStorageTokenError,
    );
    await expect(service.writeWithToken('basura', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      LocalStorageTokenError,
    );
  });

  it('rechaza content-type distinto, archivo grande y token de acción equivocada', async () => {
    const { uploadUrl, objectUrl } = service.createUploadUrl('a/x.jpg', 'image/jpeg');
    const token = tokenOf(uploadUrl);
    await expect(service.writeWithToken(token, Buffer.from('x'), 'video/mp4')).rejects.toMatchObject({
      code: 'content_type_mismatch',
    });
    await expect(service.writeWithToken(token, Buffer.alloc(11), 'image/jpeg')).rejects.toMatchObject({
      code: 'too_large',
    });
    await expect(service.readWithToken(token)).rejects.toMatchObject({ code: 'wrong_action' });
    const readToken = tokenOf(service.createReadUrl(objectUrl));
    await expect(service.writeWithToken(readToken, Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({
      code: 'wrong_action',
    });
  });

  it('bloquea path traversal y objetos inexistentes', async () => {
    expect(() => service.createUploadUrl('../fuera.jpg', 'image/jpeg')).toThrow(LocalStorageError);
    await expect(service.readByKey('a/../../etc/passwd')).rejects.toMatchObject({ code: 'invalid_key' });
    await expect(service.readByKey('no/existe.jpg')).rejects.toMatchObject({ code: 'not_found' });
  });
});
