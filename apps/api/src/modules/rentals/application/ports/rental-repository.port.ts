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
  templateVersionId: string;
  documentRef: string;
  status: string;
  signedAt: Date | null;
  createdAt: Date;
}

/// TDD-03-alquiler seccion 9.3 / BR-DOC-002 - plantilla de contrato versionada.
export interface ContractTemplateRecord {
  id: string;
  companyId: string;
  type: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  createdAt: Date;
}

export interface CreateContractTemplateInput {
  companyId: string;
  type: string;
  effectiveFrom: Date;
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
  templateVersionId: string;
  documentRef: string;
  depositAmount: string;
  currency: string;
  updatedBy: string;
}

export interface CompleteDeliveryInput {
  rentalId: string;
  scope: RentalScope;
  expectedVersion: number;
  updatedBy: string;
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

export abstract class RentalRepositoryPort {
  abstract create(input: CreateRentalInput, tx?: Prisma.TransactionClient): Promise<RentalRecord>;
  abstract findById(id: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<RentalRecord | null>;
  abstract findCustomerById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    fullName: string;
    documentNumber: string;
    isBiometricVerified?: boolean;
  } | null>;
  abstract findVehicleById(id: string): Promise<{
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    plate: string;
    brand: string;
    model: string;
    status: string;
  } | null>;
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
  abstract findActiveContractTemplate(companyId: string, type: string): Promise<{ id: string; version: number } | null>;
  abstract contractTemplateBelongsToCompany(templateVersionId: string, companyId: string): Promise<boolean>;
  abstract createContractTemplate(
    input: CreateContractTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ContractTemplateRecord>;
  abstract listContractTemplates(companyId: string): Promise<ContractTemplateRecord[]>;
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
}
