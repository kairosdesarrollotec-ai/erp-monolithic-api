import { DomainBadRequestError } from './domain-errors';

/**
 * CR-10 / R-7 (29-oct-2026): formato de documentos de identidad y telefono. Solo valida tipos conocidos
 * (DNI 8 digitos, RUC 11 digitos, CE y pasaporte alfanumericos); otros tipos pasan sin validar (conservador).
 */
export class InvalidIdentityDocumentError extends DomainBadRequestError {
  readonly code = 'INVALID_DOCUMENT_NUMBER';

  constructor(detail: string) {
    super(detail);
  }
}

export class InvalidPhoneNumberError extends DomainBadRequestError {
  readonly code = 'INVALID_PHONE_NUMBER';

  constructor() {
    super('El telefono solo admite digitos (opcionalmente con + al inicio, espacios o guiones), entre 6 y 15 digitos.');
  }
}

const RULES: Record<string, { pattern: RegExp; message: string }> = {
  DNI: { pattern: /^\d{8}$/, message: 'El DNI debe tener exactamente 8 digitos.' },
  RUC: { pattern: /^\d{11}$/, message: 'El RUC debe tener exactamente 11 digitos.' },
  CE: { pattern: /^[A-Za-z0-9]{9,12}$/, message: 'El carne de extranjeria debe ser alfanumerico de 9 a 12 caracteres.' },
  PASAPORTE: { pattern: /^[A-Za-z0-9]{6,12}$/, message: 'El pasaporte debe ser alfanumerico de 6 a 12 caracteres.' },
};

export function assertValidIdentityDocument(documentType: string, documentNumber: string): void {
  const rule = RULES[documentType.trim().toUpperCase()];
  if (!rule) return;
  if (!rule.pattern.test(documentNumber.trim())) {
    throw new InvalidIdentityDocumentError(rule.message);
  }
}

export function assertValidPhone(phone: string | null | undefined): void {
  if (phone === null || phone === undefined || phone.trim() === '') return;
  const compact = phone.trim();
  if (!/^\+?[\d\s-]+$/.test(compact)) throw new InvalidPhoneNumberError();
  const digits = compact.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) throw new InvalidPhoneNumberError();
}
