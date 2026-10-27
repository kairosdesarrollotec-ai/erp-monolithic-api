import { IsBoolean, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';
import { PAYMENT_METHODS } from '../../../../reservations/domain/reservation-payment-method';

/**
 * Decision 8 (Russbel 22-oct-2026; ALQ P-01, BR-ALQ-011): comprobante del cobro de la garantia. Obligatorio cuando hay
 * diferencia a cobrar (si el monto de la reserva cubre toda la garantia no hay cobro y se ignora).
 */
export class GuaranteePaymentDto {
  @IsIn(PAYMENT_METHODS) method!: (typeof PAYMENT_METHODS)[number];

  /** Nº de operacion; en EFECTIVO, nº de recibo. */
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) operationNumber?: string;

  @IsString() @IsNotEmpty() @MaxLength(120) payerName!: string;

  /** Obligatorio si paga un agente externo. */
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(30) payerDocumentNumber?: string;

  /** BR-ALQ-011: paga un agente externo (verificacion adicional obligatoria). */
  @IsBoolean() payerIsExternalAgent!: boolean;

  /** BR-ALQ-011: el personal confirma la verificacion adicional del agente externo. Debe ser true si payerIsExternalAgent. */
  @IsOptional() @IsBoolean() externalAgentVerified?: boolean;

  /** Id del documento PAYMENT_VOUCHER ya subido al alquiler (POST /rentals/{id}/documents). */
  @IsOptional() @IsUUID() voucherDocumentId?: string;
}

export class FormalizeContractDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  documentRef!: string;

  /**
   * C5: Huella física tomada en el contrato en papel (no biometría). Obligatorio marcarlo al formalizar.
   * El valor false se permite pero queda auditado.
   */
  @IsBoolean()
  fingerprintTaken!: boolean;

  /**
   * Garantia. Con conductor de la empresa (`withCompanyDriver=true`) NO se exige ni se cobra (DEC-ALQ-COMPANY-DRIVER-004) y
   * enviarla > 0 responde 422 DEPOSIT_NOT_APPLICABLE_WITH_COMPANY_DRIVER. Sin conductor de la empresa es OPCIONAL si Flota
   * define la garantia del vehiculo (el servidor usa la exigida: tarifa de Flota, x2 con DOUBLE_DEPOSIT); si se envia no
   * puede ser menor a la exigida (422 INVALID_DEPOSIT_AMOUNT); si Flota no la define es obligatoria (400).
   */
  @IsOptional()
  @IsNumberString()
  depositAmount?: string;

  @IsOptional()
  @IsIn(['PEN', 'USD'])
  depositCurrency?: string;

  /** Decision 8: comprobante del cobro de la garantia (medio, nº de operacion/recibo, pagador, comprobante, agente externo). */
  @IsOptional()
  @ValidateNested()
  @Type(() => GuaranteePaymentDto)
  payment?: GuaranteePaymentDto;

  /**
   * BR-DOC-003: titular natural/juridica. Junto con `withCompanyDriver` elige la
   * plantilla de contrato; si se omiten, se usa la plantilla generica.
   */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;

  /**
   * BR-DOC-003: el cliente pide que la empresa le ofrezca un conductor
   * (servicio de conductor). NO es el conductor distinto del titular de
   * BR-ALQ-015 (otra persona que maneja un alquiler sin aprobacion previa).
   */
  @ValidateIf((o: FormalizeContractDto) => o.holderType !== undefined && o.withDriver === undefined)
  @IsBoolean()
  withCompanyDriver?: boolean;

  /** DEPRECADO (DEC-ALQ-DRIVER-001): alias de withCompanyDriver. */
  @IsOptional()
  @IsBoolean()
  withDriver?: boolean;

  /** Firma digital capturada como base64 PNG. Opcional. */
  @IsOptional()
  @IsString()
  signatureData?: string;
}
