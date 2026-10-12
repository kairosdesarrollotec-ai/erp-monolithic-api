import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Politica rol-accion de Pagos (deny-by-default), version 0 de la matriz ADM-02.
 * Fuentes: BDD-PAG-001 BR-PAG-007, SDD-PAG-001 §4, payments.yaml.
 *
 * PAYMENT.READ_LIST / READ_DETAIL: FRONT_OFFICE, GERENCIA, FINANZAS, AUDITORIA
 * PAYMENT.REGISTER_ADJUSTMENT: FRONT_OFFICE (Cajero), GERENCIA
 * PAYMENT.APPROVE_REFUND: FINANZAS (Aprobador Financiero), GERENCIA
 * PAYMENT.CLOSE_FINANCIAL: FINANZAS, GERENCIA
 */
export type PaymentAction = 'READ_LIST' | 'READ_DETAIL' | 'REGISTER_ADJUSTMENT' | 'APPROVE_REFUND' | 'CLOSE_FINANCIAL';

const READ_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'FINANZAS', 'AUDITORIA']);
const ADJUSTMENT_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA']);
const FINANCE_ROLES: ReadonlySet<WorkerRole> = new Set(['FINANZAS', 'GERENCIA']);

const PAYMENT_ROLE_POLICY: Readonly<Record<PaymentAction, ReadonlySet<WorkerRole>>> = {
  READ_LIST: READ_ROLES,
  READ_DETAIL: READ_ROLES,
  REGISTER_ADJUSTMENT: ADJUSTMENT_ROLES,
  APPROVE_REFUND: FINANCE_ROLES,
  CLOSE_FINANCIAL: FINANCE_ROLES,
};

export function isPaymentRoleAllowed(role: WorkerRole, action: PaymentAction): boolean {
  return PAYMENT_ROLE_POLICY[action]?.has(role) ?? false;
}

export function assertPaymentRoleAllowed(role: WorkerRole, action: PaymentAction): void {
  if (!isPaymentRoleAllowed(role, action)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar la accion ${action} sobre Pagos.`,
    });
  }
}
