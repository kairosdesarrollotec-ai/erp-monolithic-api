import { DomainNotFoundError, DomainUnprocessableError } from '../../../common/domain/domain-errors';

export class HrDocumentNotFoundError extends DomainNotFoundError {
  readonly code = 'HR_DOCUMENT_NOT_FOUND';
  constructor(message = 'Documento de Talento Humano no encontrado o no está vigente.') {
    super(message);
  }
}

export class InvalidHrDocumentCategoryError extends DomainUnprocessableError {
  readonly code = 'INVALID_HR_DOCUMENT_CATEGORY';
  constructor(category: string) {
    super(`Categoría "${category}" no permitida. Valores válidos: REGULATION, POLICY, FORMAT.`);
  }
}

export class InvalidHrDocumentCodeError extends DomainUnprocessableError {
  readonly code = 'INVALID_HR_DOCUMENT_CODE';
  constructor(message = 'El código del documento es obligatorio y debe tener formato alfanumérico.') {
    super(message);
  }
}

export class HrDocumentEmployeeNotFoundError extends DomainNotFoundError {
  readonly code = 'HR_DOCUMENT_EMPLOYEE_NOT_FOUND';
  constructor(message = 'El usuario autenticado no tiene una ficha de colaborador vinculada en esta empresa.') {
    super(message);
  }
}
