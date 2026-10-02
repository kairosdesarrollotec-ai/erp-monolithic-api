import { DomainConflictError } from '../../../common/domain/domain-errors';

export class CustomerDocumentAlreadyExistsError extends DomainConflictError {
  readonly code = 'CUSTOMER_DOCUMENT_ALREADY_EXISTS';

  constructor(documentType: string, documentNumber: string) {
    super(`Ya existe un cliente con ${documentType} número ${documentNumber} en esta empresa.`);
  }
}
