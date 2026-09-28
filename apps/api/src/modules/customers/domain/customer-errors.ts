import { ConflictException } from '@nestjs/common';

export class CustomerDocumentAlreadyExistsError extends ConflictException {
  constructor(documentType: string, documentNumber: string) {
    super({
      code: 'CUSTOMER_DOCUMENT_ALREADY_EXISTS',
      detail: `Ya existe un cliente con ${documentType} número ${documentNumber} en esta empresa.`,
    });
  }
}
