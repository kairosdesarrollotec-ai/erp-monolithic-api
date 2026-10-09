import type { Prisma } from '@prisma/client';
import { RentalStatus } from '../../domain/rental-status';
import { AlcoholTestResult } from '../../domain/alcohol-test-result';
import { NotaryResult } from '../../domain/notary-result';
import { RentalPartyRole } from '../../domain/rental-party-role';
import { ExtensionStatus } from '../../domain/extension-status';

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
}

export interface RentalContractRecord {
  id: string;
  rentalId: string;
  /** @deprecated Legado — los contratos nuevos usan templateId (TPL-TODO-001). */
  templateVersionId: string | null;
  /** TPL-TODO-001: FK hacia templates.id para contratos nuevos. */
  templateId: string | null;
  documentRef: string;
  status: string;
  signedAt: Date | null;
  createdAt: Date;
}


export interface RentalDepositRecord {
  id: string;
  rentalId: string;
  originalAmount: string;
  currency: string;
  status: string;
  createdAt: Date;
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
}

export interface ApproveNotaryExceptionInput {
  id: string;
  scope: RentalScope;
  expectedVersion: number;
  approvedBy: string;
  justification: string;
  updatedBy: string;
}

export interface FormalizeContractInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  /** @deprecated Legado — usar templateId para contratos nuevos (TPL-TODO-001). */
  templateVersionId?: string;
  /** TPL-TODO-001: FK hacia templates.id; campo preferido para contratos nuevos. */
  templateId?: string;
  documentRef: string;
  depositAmount: string;
  currency: string;
  updatedBy: string;
  signatureData?: string;
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
    /** Semaforo de riesgo: NORMAL | ROJO (el ambar no tiene columna propia). */
    status: string;
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
  abstract formalizeContract(input: FormalizeContractInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract completeDelivery(input: CompleteDeliveryInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract findPendingExtensionByRentalId(
    rentalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RentalExtensionRecord | null>;
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
}
