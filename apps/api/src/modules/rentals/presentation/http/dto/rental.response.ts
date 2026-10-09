import { RentalStatus } from '../../../domain/rental-status';
import { AlcoholTestResult } from '../../../domain/alcohol-test-result';
import { NotaryResult } from '../../../domain/notary-result';
import { RentalPartyRole } from '../../../domain/rental-party-role';

export interface RentalPartyResponse {
  id: string;
  customerId: string;
  role: RentalPartyRole;
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
}

export interface RentalContractResponse {
  id: string;
  /** @deprecated Legado. Los contratos nuevos usan templateId (TPL-TODO-001). */
  templateVersionId: string | null;
  /** TPL-TODO-001: FK hacia templates.id para contratos nuevos. */
  templateId?: string | null;
  documentRef: string;
  status: string;
  signedAt: string | null;
  createdAt: string;
}

export interface RentalDepositResponse {
  id: string;
  originalAmount: string;
  currency: string;
  status: string;
  createdAt: string;
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
  deposit?: RentalDepositResponse | null;
}
