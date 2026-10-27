import { VehicleDataWarning } from '../../../../../common/domain/vehicle-data-warnings';
import { RentalStatus } from '../../../domain/rental-status';
import { AlcoholTestResult } from '../../../domain/alcohol-test-result';
import { NotaryResult } from '../../../domain/notary-result';
import { RentalPartyRole } from '../../../domain/rental-party-role';

export interface RentalPartyResponse {
  id: string;
  customerId: string;
  role: RentalPartyRole;
  /** DEC-ALQ-OWN-DRIVER-005: adenda firmada del conductor autorizado (solo DRIVER de persona juridica). */
  addendumDocumentRef: string | null;
  createdAt: string;
}

export interface NotaryEvaluationResponse {
  id: string;
  policyVersion: number;
  result: NotaryResult;
  reason: string;
  evaluatedAt: string;
  approvedBy: string | null;
  justification: string | null;
  /** DEC-ALQ-THIRDPATH-001: casilla de biometrico registrada por el personal en la evaluacion. */
  biometricVerified: boolean;
  biometricVerifiedBy: string | null;
  /** Alquileres previos (CERRADOS) del cliente usados en la decision (cliente antiguo = mas de 2). */
  previousRentalsCount: number | null;
  /** true = falta aprobacion de Gerencia (THIRD_PATH_ELIGIBLE / MANUAL_REVIEW sin approvedBy). */
  pendingApproval: boolean;
}

export interface RentalContractResponse {
  id: string;
  templateId?: string | null;
  documentRef: string;
  status: string;
  signedAt: string | null;
  /** BR-DOC-003: combinacion con la que se eligio la plantilla (null en contratos previos). */
  contractVariant: string | null;
  /** DEC-ALQ-COMPANY-DRIVER-004: false = con conductor de la empresa, sin garantia. */
  depositRequired: boolean;
  /** Credito de reserva sin garantia a la cual aplicarse (saldo a favor; "0.00" si no aplica). */
  reservationCreditExcess: string;
  fingerprintTaken: boolean;
  fingerprintMarkedBy?: string | null;
  fingerprintMarkedAt?: string | null;
  createdAt: string;
}

export interface RentalDepositResponse {
  id: string;
  /** Garantia TOTAL retenida (incluye el monto de reserva trasladado). */
  originalAmount: string;
  currency: string;
  status: string;
  /** P0-03 (a): parte de la garantia ya pagada como reserva ("0.00" si no aplica). */
  reservationCreditAmount: string;
  /** DEC-ALQ-RESCREDIT-002: excedente del monto de reserva sobre la garantia ("0.00" si no hay). Saldo a favor sin reembolso automatico (pendiente Finanzas). */
  reservationCreditExcess: string;
  /** Diferencia cobrada al formalizar = originalAmount - reservationCreditAmount. */
  amountCollected: string;
  /** Decision 8 (ALQ P-01 / BR-ALQ-011): comprobante del cobro (null si no hubo cobro o el deposito es previo). */
  payment: GuaranteePaymentResponse | null;
  createdAt: string;
}

export interface GuaranteePaymentResponse {
  amount: string;
  method: 'TRANSFERENCIA' | 'DEPOSITO' | 'PLIN' | 'YAPE' | 'EFECTIVO' | 'POS';
  operationNumber: string | null;
  payerName: string;
  payerDocumentNumber: string | null;
  payerIsExternalAgent: boolean;
  externalAgentVerifiedBy: string | null;
  voucherDocumentId: string | null;
  registeredBy: string | null;
}

/** BR-CON-004: documento requerido segun la nacionalidad del cliente. */
export interface RequiredDocumentResponse {
  code: string;
  label: string;
  kind: 'DOCUMENT' | 'DATA';
  /** Campo de validate-documents con el que se confirma (null para DATA, p. ej. la fecha de ingreso). */
  field: string | null;
}

/** Garantia exigida: tarifa de Flota x multiplicador notarial (x2 con DOUBLE_DEPOSIT). */
export interface RequiredGuaranteeResponse {
  baseAmount: string;
  multiplier: 1 | 2;
  amount: string;
}

export interface RentalCancellationResponse {
  reason: string;
  note: string | null;
  cancelledAt: string;
  cancelledBy: string;
}

/** P0-03 (a): traslado reserva -> garantia (vista previa; solo origen Reserva). */
export interface ReservationCreditResponse {
  applicable: boolean;
  reason: 'APPLIED' | 'NO_RESERVATION' | 'RESERVATION_NOT_ACTIVE' | 'PAYMENT_NOT_VALIDATED';
  reservationId: string | null;
  amount: string;
  currency: string | null;
}

/** Servicio de conductor de la empresa: tarifa diaria x dias (vista; solo GET detalle; no se persiste). */
export interface CompanyDriverChargeResponse {
  /** false = la tarifa diaria aun no esta definida (source NOT_DEFINED; total en "0.00"). */
  configured: boolean;
  /** DEC-ALQ-DRIVERRATE-001: origen de la tarifa (valor manual del alquiler > env > no definida). */
  source: 'MANUAL' | 'ENV' | 'NOT_DEFINED';
  dailyRate: string;
  currency: string;
  days: number;
  total: string;
}

/** BR-ALQ-012/013: estado de los 4 requisitos de una ampliacion. */
export interface ExtensionRequirementsResponse {
  noticeGiven: boolean | null;
  authorized: boolean;
  paid: boolean;
  addendumSigned: boolean;
}

export interface RentalExtensionResponse {
  id: string;
  requestedEndAt: string;
  status: 'PENDING' | 'AUTHORIZED' | 'REJECTED' | 'BREACH';
  requestedAt: string;
  resolvedAt: string | null;
  paymentId: string | null;
  addendumDocumentRef: string | null;
  requirements: ExtensionRequirementsResponse;
}

export interface RentalResponse {
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
  /** DEC-ALQ-THIRDPATH-001: vehiculo marcado por Gerencia como elegible para la tercera via notarial. */
  vehicleThirdPathEligible: boolean;
  /** BR-CON-004: nacionalidad efectiva del cliente (PERUANO | EXTRANJERO). */
  customerNationality: 'PERUANO' | 'EXTRANJERO';
  /** BR-CON-004: documentos requeridos para validate-documents segun la nacionalidad. */
  requiredDocuments: RequiredDocumentResponse[];
  /** Garantia exigida segun Flota y la evaluacion notarial (null si Flota no define garantia del vehiculo). */
  requiredGuarantee: RequiredGuaranteeResponse | null;
  /** DEC-ALQ-CANCEL-001: datos de la cancelacion manual (null si no aplica). */
  cancellation: RentalCancellationResponse | null;
  /** DEC-ALQ-CAPWARN-001: null = vehiculo sin capacidad registrada (sin tope, no bloquea). */
  vehiclePassengerCapacity: number | null;
  /** DEC-ALQ-VEHDATA-001: precio del combustible del vehiculo (null = no registrado). */
  vehicleFuelPrice: number | null;
  /** DEC-ALQ-VEHDATA-001: un aviso por cada dato del vehiculo que falta (capacidad, garantia, combustible). No bloquea. */
  vehicleWarnings: VehicleDataWarning[];
  /** DEC-ALQ-CAPWARN-002: acompanantes registrados (parties RESPONSIBLE). */
  companionsCount: number;
  planCode: string;
  status: RentalStatus;
  startAt: string | null;
  expectedEndAt: string | null;
  alcoholTestResult: AlcoholTestResult | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
  etag: string;
  parties?: RentalPartyResponse[];
  notaryEvaluation?: NotaryEvaluationResponse | null;
  contract?: RentalContractResponse | null;
  /** Null con conductor de la empresa (DEC-ALQ-COMPANY-DRIVER-004): no hay garantia. */
  deposit?: RentalDepositResponse | null;
  /** false = el alquiler es con conductor de la empresa: no se exige ni cobra garantia (N/A en Devolucion). true por defecto. */
  depositRequired?: boolean;
  /** Saldo a favor del credito de reserva, con o sin garantia ("0.00" si no hay). Sin reembolso automatico (pendiente Finanzas). */
  reservationCreditExcess?: string;
  /** Presente solo en GET /rentals/{id}; null = alquiler sin reserva de origen. */
  reservationCredit?: ReservationCreditResponse | null;
  /** Solo en GET /rentals/{id}: cargo del conductor de la empresa; null si el alquiler es sin conductor de la empresa. */
  companyDriverCharge?: CompanyDriverChargeResponse | null;
  /** Solo en GET /rentals/{id}: ampliaciones, la mas reciente primero. */
  extensions?: RentalExtensionResponse[];
}
