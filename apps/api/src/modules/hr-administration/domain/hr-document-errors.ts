import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export class HrDocumentNotFoundError extends NotFoundException {
  constructor(message = 'Documento de Talento Humano no encontrado o no está vigente.') {
    super({
      statusCode: 404,
      code: 'HR_DOCUMENT_NOT_FOUND',
      detail: message,
    });
  }
}

export class InvalidHrDocumentCategoryError extends UnprocessableEntityException {
  constructor(category: string) {
    super({
      statusCode: 422,
      code: 'INVALID_HR_DOCUMENT_CATEGORY',
      detail: `Categoría "${category}" no permitida. Valores válidos: REGULATION, POLICY, FORMAT.`,
    });
  }
}

export class InvalidHrDocumentCodeError extends UnprocessableEntityException {
  constructor(message = 'El código del documento es obligatorio y debe tener formato alfanumérico.') {
    super({
      statusCode: 422,
      code: 'INVALID_HR_DOCUMENT_CODE',
      detail: message,
    });
  }
}

export class HrDocumentEmployeeNotFoundError extends NotFoundException {
  constructor(message = 'El usuario autenticado no tiene una ficha de colaborador vinculada en esta empresa.') {
    super({
      statusCode: 404,
      code: 'HR_DOCUMENT_EMPLOYEE_NOT_FOUND',
      detail: message,
    });
  }
}
