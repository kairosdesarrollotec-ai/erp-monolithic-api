import { ExtensionStatus } from './extension-status';

/** BR-ALQ-012: la ampliacion se avisa con al menos 12 horas de anticipacion al vencimiento. */
export const EXTENSION_NOTICE_HOURS = 12;

export interface ExtensionRequirements {
  /**
   * 1. Aviso con 12 h de anticipacion al vencimiento vigente. null cuando ya no
   *    se puede reconstruir (el vencimiento cambio al autorizarse la ampliacion).
   */
  noticeGiven: boolean | null;
  /** 2. Autorizacion formal. */
  authorized: boolean;
  /** 3. Pago del periodo adicional. */
  paid: boolean;
  /** 4. Adenda firmada. */
  addendumSigned: boolean;
}

/**
 * BR-ALQ-012/013 - estado de los 4 requisitos de una ampliacion a partir de lo
 * realmente registrado (no se asume nada): sirve de base para ALQ-11
 * (confirmar falta grave) y para el detalle del alquiler activo (ALQ-10).
 */
export function evaluateExtensionRequirements(
  extension: {
    status: ExtensionStatus;
    requestedAt: Date;
    paymentId: string | null;
    addendumDocumentRef: string | null;
  },
  rentalExpectedEndAt: Date | null,
): ExtensionRequirements {
  let noticeGiven: boolean | null = null;
  if (extension.status !== 'AUTHORIZED' && rentalExpectedEndAt) {
    const limit = rentalExpectedEndAt.getTime() - EXTENSION_NOTICE_HOURS * 3_600_000;
    noticeGiven = extension.requestedAt.getTime() <= limit;
  }
  return {
    noticeGiven,
    authorized: extension.status === 'AUTHORIZED',
    paid: extension.paymentId !== null,
    addendumSigned: extension.addendumDocumentRef !== null,
  };
}
