import type { AdjustmentType } from '../../domain/adjustment-type';
import type { DepositStatus } from '../../domain/deposit-status';

/**
 * Scope de multiempresa para garantias: el organizationId sale siempre de la asignacion real del actor,
 * nunca del cliente. branchId es opcional en listados (puede listar toda la empresa).
 */
export interface DepositScope {
  organizationId: string;
  companyId: string;
  branchId?: string;
}

/** Proyeccion de ajuste individual (append-only, BR-PAG-003). */
export interface AdjustmentRecord {
  id: string;
  depositId: string;
  type: AdjustmentType;
  amount: number;
  reason: string;
  authorizedBy: string;
  createdAt: Date;
}

/** Proyeccion completa de la garantia con historial de ajustes (PAG-02). */
export interface DepositAggregate {
  id: string;
  rentalId: string;
  rentalCode: string;
  clientName: string;
  vehiclePlate: string | null;
  originalAmount: number;
  currency: string;
  status: DepositStatus;
  closedAt: Date | null;
  closureNotes: string | null;
  createdAt: Date;
  /** updatedAt derivado: createdAt del ultimo ajuste, o createdAt del deposito si no hay ajustes. */
  updatedAt: Date;
  adjustments: AdjustmentRecord[];
}

/** Proyeccion resumida para la bandeja (PAG-01). */
export interface DepositSummary {
  id: string;
  rentalId: string;
  rentalCode: string;
  clientName: string;
  originalAmount: number;
  currency: string;
  /** Suma de todos los montos de ajuste registrados. */
  adjustedAmount: number | null;
  /** originalAmount - adjustedAmount. */
  netAmount: number | null;
  currentStatus: DepositStatus;
  createdAt: Date;
}

export interface ListDepositsFilters {
  status?: DepositStatus;
  rentalId?: string;
  limit: number;
  cursor?: { createdAt: Date; id: string };
}

export interface NewAdjustment {
  type: AdjustmentType;
  amount: number;
  reason: string;
  authorizedBy: string;
}

/**
 * Puerto de persistencia de Garantias de Alquiler (INV-PAG-002: no existe update ni delete en ajustes).
 * INV-PAG-005: todas las consultas filtran por companyId del actor.
 */
export abstract class DepositRepositoryPort {
  abstract findById(id: string, scope: DepositScope): Promise<DepositAggregate | null>;
  abstract findByRentalId(rentalId: string, scope: DepositScope): Promise<DepositAggregate | null>;
  abstract listByScope(scope: DepositScope, filters: ListDepositsFilters): Promise<{ data: DepositSummary[]; total: number }>;
  abstract updateStatus(id: string, status: DepositStatus, closedAt?: Date, closureNotes?: string): Promise<void>;
  abstract addAdjustment(depositId: string, adjustment: NewAdjustment): Promise<AdjustmentRecord>;
}
