import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import {
  LocalStorageTokenPayload,
  signLocalStorageToken,
  verifyLocalStorageToken,
} from './local-storage-token';

export const DEV_STORAGE_PREFIX = 'dev-storage';
export const LOCAL_STORAGE_TTL_MS = 15 * 60 * 1000;
export const LOCAL_STORAGE_READ_TTL_MS = 60 * 60 * 1000;
/** Límite por objeto (video de evidencia). */
export const LOCAL_STORAGE_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_SECRET = 'kairos-dev-local-storage-secret';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export class LocalStorageError extends Error {
  constructor(
    readonly code: 'invalid_key' | 'not_found' | 'content_type_mismatch' | 'too_large' | 'wrong_action',
    message: string,
  ) {
    super(message);
    this.name = 'LocalStorageError';
  }
}

export interface LocalStorageOptions {
  rootDir: string;
  secret: string;
  publicUrl: string;
  maxBytes?: number;
}

/**
 * Almacenamiento en disco SOLO para desarrollo. Emula el contrato de GCS:
 * "URL firmada" de subida (PUT al propio API) y URL de objeto estable.
 */
export class LocalStorageService {
  private readonly rootDir: string;
  private readonly secret: string;
  private readonly publicUrl: string;
  readonly maxBytes: number;

  constructor(options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.secret = options.secret;
    this.publicUrl = options.publicUrl.replace(/\/+$/, '');
    this.maxBytes = options.maxBytes ?? LOCAL_STORAGE_MAX_BYTES;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): LocalStorageService {
    return new LocalStorageService({
      rootDir: env.LOCAL_STORAGE_DIR?.trim() || resolve(process.cwd(), '.local-storage'),
      secret: env.LOCAL_STORAGE_SECRET?.trim() || DEFAULT_SECRET,
      publicUrl: env.API_PUBLIC_URL?.trim() || `http://localhost:${env.PORT ?? 3000}`,
    });
  }

  private get objectBase(): string {
    return `${this.publicUrl}/${DEV_STORAGE_PREFIX}/objects/`;
  }

  /** Equivalente a getSignedUrl({action:'write'}) + URL permanente del objeto. */
  createUploadUrl(
    key: string,
    contentType: string,
    ttlMs: number = LOCAL_STORAGE_TTL_MS,
    now: number = Date.now(),
  ): { uploadUrl: string; objectUrl: string; expiresAt: Date } {
    this.resolveKey(key);
    const exp = now + ttlMs;
    const token = signLocalStorageToken({ key, action: 'write', contentType, exp }, this.secret);
    return {
      uploadUrl: `${this.publicUrl}/${DEV_STORAGE_PREFIX}/upload/${token}`,
      objectUrl: `${this.objectBase}${key}`,
      expiresAt: new Date(exp),
    };
  }

  /** Equivalente a getSignedUrl({action:'read'}); si no es un objeto local, devuelve la URL tal cual. */
  createReadUrl(objectUrl: string, ttlMs: number = LOCAL_STORAGE_READ_TTL_MS, now: number = Date.now()): string {
    if (!objectUrl.startsWith(this.objectBase)) return objectUrl;
    const key = decodeURIComponent(objectUrl.slice(this.objectBase.length));
    const token = signLocalStorageToken({ key, action: 'read', exp: now + ttlMs }, this.secret);
    return `${this.publicUrl}/${DEV_STORAGE_PREFIX}/files/${token}`;
  }

  /** Valida el token de subida y escribe el cuerpo a disco. */
  async writeWithToken(token: string, body: Buffer, contentType: string | undefined, now = Date.now()) {
    const payload = verifyLocalStorageToken(token, this.secret, now);
    if (payload.action !== 'write') throw new LocalStorageError('wrong_action', 'El token no permite subir.');
    return this.writeObject(payload, body, contentType);
  }

  private async writeObject(payload: LocalStorageTokenPayload, body: Buffer, contentType: string | undefined) {
    const declared = (contentType ?? '').split(';')[0].trim().toLowerCase();
    if (!payload.contentType || declared !== payload.contentType.toLowerCase()) {
      throw new LocalStorageError(
        'content_type_mismatch',
        `Content-Type "${declared}" no coincide con el autorizado "${payload.contentType}".`,
      );
    }
    if (body.length > this.maxBytes) throw new LocalStorageError('too_large', 'Archivo demasiado grande.');
    const file = this.resolveKey(payload.key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    return { key: payload.key, bytes: body.length };
  }

  /** Lectura autorizada por token firmado (GET /files/:token). */
  async readWithToken(token: string, now = Date.now()) {
    const payload = verifyLocalStorageToken(token, this.secret, now);
    if (payload.action !== 'read') throw new LocalStorageError('wrong_action', 'El token no permite leer.');
    return this.readByKey(payload.key);
  }

  /** Lectura por clave (GET /objects/*, URL permanente de desarrollo). */
  async readByKey(key: string): Promise<{ data: Buffer; contentType: string }> {
    const file = this.resolveKey(key);
    try {
      if (!(await stat(file)).isFile()) throw new Error('not file');
      return { data: await readFile(file), contentType: this.contentTypeFor(key) };
    } catch {
      throw new LocalStorageError('not_found', 'Objeto no encontrado.');
    }
  }

  contentTypeFor(key: string): string {
    return CONTENT_TYPE_BY_EXT[extname(key).toLowerCase()] ?? 'application/octet-stream';
  }

  /** Resuelve la clave dentro del directorio raíz, bloqueando path traversal. */
  private resolveKey(key: string): string {
    if (!key || key.includes('\0') || key.includes('\\') || key.split('/').some((p) => p === '..' || p === '')) {
      throw new LocalStorageError('invalid_key', 'Clave de objeto inválida.');
    }
    const file = resolve(this.rootDir, key);
    if (!file.startsWith(this.rootDir + sep)) throw new LocalStorageError('invalid_key', 'Clave de objeto inválida.');
    return file;
  }
}

let singleton: LocalStorageService | null = null;
export function getLocalStorageService(): LocalStorageService {
  singleton ??= LocalStorageService.fromEnv();
  return singleton;
}
