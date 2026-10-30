import type { CompanyDriverCharge } from '../../domain/company-driver-charge';
import type { Prisma } from '@prisma/client';
import { RentalStatus } from '../../domain/rental-status';
import { AlcoholTestResult } from '../../domain/alcohol-test-result';
import { NotaryResult } from '../../domain/notary-result';
import { RentalPartyRole } from '../../domain/rental-party-role';
import { ExtensionStatus } from '../../domain/extension-status';
import type { ReservationCreditResolution, ReservationCreditSource } from '../../domain/reservation-credit';

export interface RentalScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface RentalPartyRecord {
  id: string;
  rentalId: string;
  customerId: string;
  role: RentalPartyRole;
  /** DEC-ALQ-OWN-DRIVER-005: adenda firmada del conductor autorizado (DRIVER de persona juridica). */
  addendumDocumentRef?: string | null;
  createdAt: Date;
}

export interface NotaryEvaluationRecord {
  id: string;
  rentalId: string;
  policyVersion: number;
  result: NotaryResult;
  reason: string;
  evaluatedAt: Date;
  approvedBy: string | null;
  justification: string | null;
  /** DEC-ALQ-THIRDPATH-001: casilla de biometrico registrada por el personal. */
  biometricVerified?: boolean;
  biometricVerifiedBy?: string | null;
  /** Alquileres previos (CLOSED) del cliente usados en la decision. */
  previousRentalsCount?: number | null;
}

export interface RentalContractRecord {
  id: string;
  rentalId: string;
  templateId: string | null;
  documentRef: string;
  status: string;
  signedAt: Date | null;
  /** BR-DOC-003: combinacion con la que se eligio la plantilla (null en contratos previos). */
  contractVariant?: string | null;
  /** DEC-ALQ-COMPANY-DRIVER-004: false = con conductor de la empresa, sin garantia (no hay fila de deposit). Default true. */
  depositRequired?: boolean;
  /** DEC-ALQ-COMPANY-DRIVER-004: credito de reserva sin garantia (saldo a favor). "0.00" si no aplica. */
  reservationCreditExcess?: string;
  fingerprintTaken?: boolean;
  fingerprintMarkedBy?: string | null;
  fingerprintMarkedAt?: Date | null;
  createdAt: Date;
}


export interface RentalDepositRecord {
  id: string;
  rentalId: string;
  /** Garantia TOTAL retenida (incluye el monto de reserva trasladado). */
  originalAmount: string;
  currency: string;
  status: string;
  /** P0-03 (a): parte de la garantia ya pagada como reserva. "0.00" en alquiler directo. */
  reservationCreditAmount?: string;
  /** DEC-ALQ-RESCREDIT-002: excedente del monto de reserva sobre la garantia (saldo a favor, sin reembolso automatico). */
  reservationCreditExcess?: string;
  /** Decision 8 (22-oct-2026, ALQ P-01 / BR-ALQ-011): comprobante del cobro de la garantia (null si no hubo cobro o es previo). */
  payment?: RentalDepositPaymentRecord | null;
  createdAt: Date;
}

export interface RentalDepositPaymentRecord {
  amount: string;
  method: string;
  operationNumber: string | null;
  payerName: string;
  payerDocumentNumber: string | null;
  payerIsExternalAgent: boolean;
  externalAgentVerifiedBy: string | null;
  voucherDocumentId: string | null;
  registeredBy: string | null;
}

export interface RentalRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  inquiryId: string | null;
  reservationId: string | null;
  customerId: string;
  customerName: string;
  customerDocNumber: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleDepositMinimum: number | null;
  /** DEC-ALQ-THIRDPATH-001: vehiculo marcado por Gerencia como elegible para la tercera via. */
  vehicleThirdPathEligible?: boolean;
  /** BR-CON-004: nacionalidad del cliente (null en clientes antiguos sin dato). */
  customerNationality?: 'PERUANO' | 'EXTRANJERO' | null;
  customerDocumentType?: string;
  customerCountryEntryDate?: Date | null;
  planCode: string;
  status: RentalStatus;
  startAt: Date | null;
  expectedEndAt: Date | null;
  alcoholTestResult: AlcoholTestResult | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
  parties?: RentalPartyRecord[];
  notaryEvaluation?: NotaryEvaluationRecord | null;
  contract?: RentalContractRecord | null;
  deposit?: RentalDepositRecord | null;
  /**
   * P0-03 (a): traslado reserva -> garantia. Lo completa GetRentalHandler (no
   * se persiste): vista previa mientras el contrato no se formaliza.
   * null = alquiler sin reserva de origen.
   */
  reservationCredit?: ReservationCreditResolution | null;
  /** Solo en el detalle (GET): ampliaciones del alquiler, la mas reciente primero. */
  extensions?: RentalExtensionRecord[];
  /** Solo en el listado: true si el alquiler tiene una falta grave de ampliacion registrada (BR-ALQ-013); decisión 28-oct #11. */
  hasExtensionBreach?: boolean;
  /**
   * TODO(DEC-ALQ-CAPACITY-009): capacidad de pasajeros del vehiculo. `vehicles` no tiene la columna todavia
   * (requiere migracion en Flota); mientras no se complete no se valida el maximo de acompanantes.
   */
  vehiclePassengerCapacity?: number | null;
  /** DEC-ALQ-VEHDATA-001: precio del combustible del vehiculo (null = no registrado). */
  vehicleFuelPrice?: number | null;
  /** DEC-ALQ-DRIVERRATE-001: tarifa diaria manual del conductor de la empresa ("0.00" formato 2 decimales; null = sin valor manual). */
  companyDriverDailyRate?: string | null;
  /** DEC-ALQ-CANCEL-001: datos de la cancelacion manual (null si no fue cancelado manualmente). */
  cancellation?: { reason: string; note: string | null; cancelledAt: Date; cancelledBy: string } | null;
  /** Solo en el detalle (GET) y tras fijar la tarifa, en alquileres con conductor de la empresa: tarifa diaria x dias (no se persiste). */
  companyDriverCharge?: CompanyDriverCharge | null;
}

export interface CreateRentalInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  planCode?: string;
  startAt?: Date;
  expectedEndAt?: Date;
  reservationId?: string;
  inquiryId?: string;
  createdBy: string;
}

export interface ValidateDocumentsInput {
  id: string;
  scope: RentalScope;
  expectedVersion: number;
  updatedBy: string;
}

export interface RegisterAlcoholTestInput {
  id: string;
  scope: RentalScope;
  expectedVersion: number;
  result: AlcoholTestResult;
  updatedBy: string;
}

export interface SaveNotaryEvaluationInput {
  rentalId: string;
  policyVersion: number;
  result: NotaryResult;
  reason: string;
  approvedBy?: string;
  justification?: string;
  biometricVerified?: boolean;
  biometricVerifiedBy?: string;
  previousRentalsCount?: number;
}

export interface ApproveNotaryExceptionInput {
  id: string;
  scope: RentalScope;
  expectedVersion: number;
  approvedBy: string;
  justification: string;
  updatedBy: string;
}

export interface AddAuthorizedDriverInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  customerId: string;
  /** Rol de la party: DRIVER (conductor autorizado de persona juridica, por defecto) o RESPONSIBLE (acompanante autorizado de persona natural). */
  role?: 'DRIVER' | 'RESPONSIBLE';
  /** Obligatoria para DRIVER; opcional (null) para el acompanante RESPONSIBLE. */
  addendumDocumentRef: string | null;
  updatedBy: string;
}

export interface SetCompanyDriverDailyRateInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  /** Monto > 0 con maximo 2 decimales (ya validado). */
  dailyRate: string;
  updatedBy: string;
}

export interface FormalizeContractInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  templateId?: string;
  documentRef: string;
  /** DEC-ALQ-COMPANY-DRIVER-004: false = sin garantia (conductor de la empresa): no se crea fila de deposit. */
  depositRequired: boolean;
  /** Garantia TOTAL (reserva trasladada + diferencia cobrada). "0.00" si depositRequired=false. */
  depositAmount: string;
  currency: string;
  /** P0-03 (a): monto de la reserva trasladado a la garantia ("0.00" si no aplica). */
  reservationCreditAmount: string;
  /** DEC-ALQ-RESCREDIT-002: excedente del monto de reserva sobre la garantia ("0.00" si no hay). */
  reservationCreditExcess: string;
  /** BR-DOC-003: codigo de la combinacion elegida, si el cliente la indico. */
  contractVariant?: string;
  updatedBy: string;
  signatureData?: string;
  fingerprintTaken?: boolean;
  fingerprintMarkedBy?: string | null;
  fingerprintMarkedAt?: Date | null;
  /** Decision 8: comprobante del cobro de la garantia (solo si hubo cobro > 0). */
  payment?: FormalizeContractPaymentInput;
}

export interface FormalizeContractPaymentInput {
  amount: string;
  method: string;
  operationNumber?: string;
  payerName: string;
  payerDocumentNumber?: string;
  payerIsExternalAgent: boolean;
  externalAgentVerifiedBy?: string;
  voucherDocumentId?: string;
  registeredBy: string;
}

export interface CancelRentalInput {
  id: string;
  scope: RentalScope;
  expectedVersion: number;
  reason: string;
  note?: string;
  cancelledBy: string;
  cancelledAt: Date;
}

export interface CompleteDeliveryInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  updatedBy: string;
  /**
   * Alquiler directo (Consulta/sin origen): fecha real de entrega y fin
   * esperado derivado. Se omiten en alquileres de origen Reserva, que
   * conservan las fechas acordadas (BDD-RES-001 / DAT-RES-007).
   */
  startAt?: Date;
  expectedEndAt?: Date;
}

/** Cotizacion de la consulta vinculada, solo los campos que Alquiler necesita. */
export interface RentalInquiryQuotation {
  id: string;
  vehicleId: string;
  estimatedDays: number;
  validUntil: Date;
  createdAt: Date;
}

/** Vista minima de Consulta para validar `inquiryId` y derivar fechas de entrega. */
export interface RentalInquiryRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  customerId: string | null;
  status: string;
  /** Mas reciente primero. */
  quotations: RentalInquiryQuotation[];
}

export interface ListRentalsFilter extends RentalScope {
  status?: RentalStatus;
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface RentalExtensionRecord {
  id: string;
  rentalId: string;
  requestedEndAt: Date;
  status: ExtensionStatus;
  paymentId: string | null;
  addendumDocumentRef: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}

export interface RequestExtensionInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  requestedEndAt: Date;
  updatedBy: string;
}

export interface AuthorizeExtensionInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  extensionId: string;
  paymentId?: string;
  addendumDocumentRef?: string;
  updatedBy: string;
}

export interface RejectExtensionInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  extensionId: string;
  updatedBy: string;
}

export interface ReportExtensionBreachInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  extensionId: string;
  customerId: string;
  legalEvaluationNote: string;
  updatedBy: string;
}

export abstract class RentalRepositoryPort {
  abstract create(input: CreateRentalInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract findById(id: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<RentalRecord | null>;
  abstract findCustomerById(id: string, tx?: Prisma.TransactionClient): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    fullName: string;
    documentNumber: string;
    /** DNI | RUC | CE ... (deduce el tipo de titular: RUC -> juridica, DNI -> natural). */
    documentType?: string;
    /** Semaforo de riesgo: NORMAL | ROJO (el ambar no tiene columna propia). */
    status: string;
    nationality?: 'PERUANO' | 'EXTRANJERO' | null;
    countryEntryDate?: Date | null;
    isBiometricVerified?: boolean;
  } | null>;
  abstract findVehicleById(id: string, tx?: Prisma.TransactionClient): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    /** null = vehiculo compartido entre sedes de la empresa. */
    branchId: string | null;
    plate: string;
    brand: string;
    model: string;
    status: string;
    /** Garantia del vehiculo (Flota, `deposit_minimum`); null = no definida. */
    depositMinimum?: number | null;
    thirdPathEligible?: boolean;
  } | null>;
  abstract findInquiryForRental(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<RentalInquiryRecord | null>;
  /**
   * true si el vehiculo tiene un compromiso ACTIVE o CONSOLIDATED (reserva
   * confirmada, etc.) que se solapa con [startsAt, endsAt).
   */
  abstract hasBlockingVehicleCommitment(
    vehicleId: string,
    organizationId: string,
    startsAt: Date,
    endsAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean>;
  /**
   * UC-RES-005 / RES-08: CONFIRMED -> CONVERTED de la reserva de origen, en la
   * transaccion del alquiler. `updateMany` atomico con scope completo + estado
   * CONFIRMED en el where (version++); devuelve false si otra operacion se
   * adelanto (cancelacion, venta, otra conversion). No toca el monto pagado
   * (DEC-P0-03 sigue leyendose de la reserva).
   */
  abstract markReservationConverted(
    reservationId: string,
    scope: RentalScope,
    tx: Prisma.TransactionClient,
  ): Promise<boolean>;
  /**
   * El alquiler hereda el `vehicle_commitment` de la reserva: se re-asigna el
   * mismo compromiso (RESERVATION -> RENTAL, sigue CONSOLIDATED) en lugar de
   * liberar y crear otro, asi el vehiculo no queda libre ni un instante y no
   * hay doble conflicto de solape. Devuelve cuantos compromisos se movieron.
   */
  abstract transferReservationCommitmentToRental(
    reservationId: string,
    rentalId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number>;
  /** Alquiler ya creado para una reserva (reintento idempotente de convert). */
  abstract findByReservationId(
    reservationId: string,
    scope: RentalScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord | null>;
  abstract findReservationById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    branchId: string;
    customerId: string;
    vehicleId: string;
    status: string;
    startAt: Date;
    endAt: Date;
  } | null>;
  /**
   * P0-03 (a): datos de la reserva de origen (monto, estado, pago validado)
   * para decidir el traslado a la garantia. null si la reserva no existe.
   */
  abstract findReservationCreditSource(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationCreditSource | null>;
  /**
   * Decision 1 (22-oct-2026): marca la consulta COTIZADA -> CONVERTIDA en la transaccion de `POST /rentals`
   * (updateMany con scope + estado COTIZADA; version++). false si otra operacion se adelanto.
   */
  abstract markInquiryConverted(
    inquiryId: string,
    scope: RentalScope,
    tx: Prisma.TransactionClient,
  ): Promise<boolean>;
  /** Documento del alquiler por id (para validar el comprobante del cobro de la garantia). */
  abstract findRentalDocumentById(
    documentId: string,
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string; documentType: string } | null>;
  /** Cantidad de documentos de un tipo subidos al alquiler (p. ej. RESPONSIBILITY_DOCUMENT de la tercera via). */
  abstract countRentalDocumentsByType(
    rentalId: string,
    documentType: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
  /** DEC-ALQ-CANCEL-001: cancela el alquiler (estado + motivo) y libera su compromiso de vehiculo. */
  abstract cancel(input: CancelRentalInput, tx: Prisma.TransactionClient): Promise<RentalRecord>;
  /**
   * CR-03 / Decisiones 29-oct #5: cancelar el alquiler cancela todo el proceso, incluida la reserva de origen
   * (CONVERTED -> CANCELLED). Devuelve true si cancelo una reserva; false si no habia o ya no estaba CONVERTED.
   */
  abstract cancelOriginReservation(reservationId: string, scope: RentalScope, tx: Prisma.TransactionClient): Promise<boolean>;
  abstract countPreviousRentalsByCustomer(customerId: string, operatingCompanyId: string): Promise<number>;
  abstract list(filter: ListRentalsFilter): Promise<RentalRecord[]>;
  abstract transitionStatus(
    id: string,
    scope: RentalScope,
    newStatus: RentalStatus,
    expectedVersion: number,
    updatedBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord>;
  abstract saveAlcoholTest(input: RegisterAlcoholTestInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract saveNotaryEvaluation(input: SaveNotaryEvaluationInput, tx?: Prisma.TransactionClient): Promise<void>;
  abstract approveNotaryException(input: ApproveNotaryExceptionInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  /** DEC-ALQ-OWN-DRIVER-005: agrega la party DRIVER (conductor autorizado de persona juridica) con su adenda. */
  abstract addAuthorizedDriver(input: AddAuthorizedDriverInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  /** DEC-ALQ-DRIVERRATE-001: fija la tarifa diaria manual del conductor de la empresa e incrementa la version. */
  abstract setCompanyDriverDailyRate(input: SetCompanyDriverDailyRateInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract formalizeContract(input: FormalizeContractInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract completeDelivery(input: CompleteDeliveryInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract findPendingExtensionByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord | null>;
  /** Todas las ampliaciones del alquiler, la mas reciente primero (ALQ-10/ALQ-11). */
  abstract listExtensionsByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord[]>;
  /** Ids (de los recibidos) con una ampliacion en estado BREACH (falta grave registrada). */
  abstract findRentalIdsWithExtensionBreach(
    rentalIds: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<Set<string>>;
  abstract findVehicleCommitmentOverlap(
    vehicleId: string,
    organizationId: string,
    excludeSourceType: string,
    excludeSourceId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean>;
  abstract requestExtension(input: RequestExtensionInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract authorizeExtension(input: AuthorizeExtensionInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract rejectExtension(input: RejectExtensionInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract reportExtensionBreach(
    input: ReportExtensionBreachInput,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord>;
  abstract incrementVersion(
    id: string,
    scope: RentalScope,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalRecord>;
}
