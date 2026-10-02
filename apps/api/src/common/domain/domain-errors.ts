/**
 * Errores de dominio framework-agnosticos. El mapeo a HTTP vive en
 * DomainExceptionFilter (common/http/), no en las clases de error.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly detail: string;
  readonly extra?: Record<string, unknown>;

  constructor(detail: string, extra?: Record<string, unknown>) {
    super(detail);
    this.name = this.constructor.name;
    this.detail = detail;
    this.extra = extra;
  }
}

export abstract class DomainConflictError extends DomainError {
  readonly httpStatus = 409;
}

export abstract class DomainNotFoundError extends DomainError {
  readonly httpStatus = 404;
}

export abstract class DomainUnprocessableError extends DomainError {
  readonly httpStatus = 422;
}

export abstract class DomainPreconditionError extends DomainError {
  readonly httpStatus = 412;
}

export abstract class DomainPreconditionRequiredError extends DomainError {
  readonly httpStatus = 428;
}

export abstract class DomainServiceUnavailableError extends DomainError {
  readonly httpStatus = 503;
}

export abstract class DomainForbiddenError extends DomainError {
  readonly httpStatus = 403;
}
