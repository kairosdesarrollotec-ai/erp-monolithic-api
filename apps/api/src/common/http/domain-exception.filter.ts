import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../domain/domain-errors';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const body: Record<string, unknown> = {
      statusCode: err.httpStatus,
      code: err.code,
      detail: err.detail,
    };
    if (err.extra) {
      Object.assign(body, err.extra);
    }
    res.status(err.httpStatus).json(body);
  }
}
