import {
  DomainNotFoundError,
  DomainConflictError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

/**
 * TDD-KAIROS-MVP-002-TPL §4.1 — Invariantes de dominio del módulo Templates.
 */
export class TemplateNotFoundError extends DomainNotFoundError {
  readonly code = 'TEMPLATE_NOT_FOUND';
  constructor(id: string) {
    super(`Plantilla no encontrada: ${id}`);
  }
}

/**
 * TDD-TPL §6.3 — La plantilla ya no está en DRAFT (no se puede activar).
 * HTTP 409 TEMPLATE_DRAFT_REQUIRED.
 */
export class TemplateDraftRequiredError extends DomainConflictError {
  readonly code = 'TEMPLATE_DRAFT_REQUIRED';
  constructor(id: string, currentStatus: string) {
    super(`La plantilla ${id} debe estar en estado DRAFT para activarse; estado actual: ${currentStatus}`);
  }
}

/**
 * TDD-TPL §6.3 — objectUrl no es una URL GCS válida.
 * HTTP 422 MISSING_DOCUMENT_URL.
 */
export class MissingDocumentUrlError extends DomainUnprocessableError {
  readonly code = 'MISSING_DOCUMENT_URL';
  constructor() {
    super('objectUrl debe ser una URL HTTPS de GCS válida para activar la plantilla.');
  }
}
