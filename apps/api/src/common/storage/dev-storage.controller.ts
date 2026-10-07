import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalStorageError, DEV_STORAGE_PREFIX, getLocalStorageService } from './local-storage.service';
import { LocalStorageTokenError } from './local-storage-token';

/**
 * Endpoints de almacenamiento local (SOLO desarrollo; ver DevStorageModule).
 * Sin guard de Firebase a propósito: el token firmado (HMAC + expiración) es la autorización.
 */
@Controller(DEV_STORAGE_PREFIX)
export class DevStorageController {
  private readonly storage = getLocalStorageService();

  @Put('upload/:token')
  @HttpCode(200)
  async upload(@Param('token') token: string, @Req() req: Request) {
    const declaredLength = Number(req.headers['content-length'] ?? 0);
    if (declaredLength > this.storage.maxBytes) throw new PayloadTooLargeException('Archivo demasiado grande.');
    const body = await this.readBody(req);
    try {
      return await this.storage.writeWithToken(token, body, req.headers['content-type']);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  @Get('files/:token')
  async download(@Param('token') token: string, @Res() res: Response) {
    try {
      const { data, contentType } = await this.storage.readWithToken(token);
      this.send(res, data, contentType);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  /** URL permanente de objeto (la que se guarda en BD como objectUrl); solo desarrollo. */
  @Get('objects/*')
  async object(@Req() req: Request, @Res() res: Response) {
    const marker = `/${DEV_STORAGE_PREFIX}/objects/`;
    const path = req.path;
    const key = decodeURIComponent(path.slice(path.indexOf(marker) + marker.length));
    try {
      const { data, contentType } = await this.storage.readByKey(key);
      this.send(res, data, contentType);
    } catch (e) {
      throw this.toHttp(e);
    }
  }

  private send(res: Response, data: Buffer, contentType: string) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', data.length);
    // Permite <img>/<video> desde el front en otro origen (localhost:5173 -> :3000).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).end(data);
  }

  private readBody(req: Request): Promise<Buffer> {
    const max = this.storage.maxBytes;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > max) {
          reject(new PayloadTooLargeException('Archivo demasiado grande.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  private toHttp(e: unknown): Error {
    if (e instanceof LocalStorageTokenError) return new ForbiddenException(e.message);
    if (e instanceof LocalStorageError) {
      switch (e.code) {
        case 'not_found':
          return new NotFoundException(e.message);
        case 'content_type_mismatch':
          return new UnsupportedMediaTypeException(e.message);
        case 'too_large':
          return new PayloadTooLargeException(e.message);
        case 'wrong_action':
          return new ForbiddenException(e.message);
        default:
          return new BadRequestException(e.message);
      }
    }
    return e as Error;
  }
}
