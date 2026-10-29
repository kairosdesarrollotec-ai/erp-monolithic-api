import { Controller, Get, NotFoundException, Put, Req, Res, PayloadTooLargeException, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../decorators/public.decorator';
import { isLocalDevStorageEnabled, localDevStorageDir } from './local-dev-storage';

const MAX_BYTES = 60 * 1024 * 1024;
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function keyOf(req: Request): string {
  const raw = (req.params as Record<string, string | string[]>).path;
  return Array.isArray(raw) ? raw.join('/') : (raw ?? '');
}

function resolveSafe(rawKey: string): string {
  const root = localDevStorageDir();
  const key = decodeURIComponent(rawKey).replace(/^\/+/, '');
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) {
    throw new BadRequestException('Ruta de almacenamiento inválida.');
  }
  if (!CONTENT_TYPE_BY_EXT[path.extname(target).toLowerCase()]) {
    throw new BadRequestException('Tipo de archivo no permitido.');
  }
  return target;
}

/**
 * Equivalente local de la URL firmada de GCS (solo desarrollo, LOCAL_STORAGE_ENABLED=true).
 * Fuera de ese modo responde 404 como si la ruta no existiera.
 */
@Public()
@Controller('dev-storage')
@SkipThrottle()
export class DevStorageController {
  @Put('*path')
  async put(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!isLocalDevStorageEnabled()) throw new NotFoundException();
    const target = resolveSafe(keyOf(req));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let received = 0;
    const out = fs.createWriteStream(target);
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BYTES) {
          req.destroy();
          out.destroy();
          fs.rmSync(target, { force: true });
          reject(new PayloadTooLargeException());
        }
      });
      req.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      req.pipe(out);
    });
    res.status(200).end();
  }

  @Get('*path')
  get(@Req() req: Request, @Res() res: Response): void {
    if (!isLocalDevStorageEnabled()) throw new NotFoundException();
    const target = resolveSafe(keyOf(req));
    if (!fs.existsSync(target)) throw new NotFoundException();
    res.setHeader('Content-Type', CONTENT_TYPE_BY_EXT[path.extname(target).toLowerCase()]);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    fs.createReadStream(target).pipe(res);
  }
}
