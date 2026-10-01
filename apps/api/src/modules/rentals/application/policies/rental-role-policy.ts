import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

export type RentalAction =
  | 'CREATE'
  | 'READ'
  | 'VALIDATE_DOCUMENTS'
  | 'REGISTER_ALCOHOL_TEST'
  | 'EVALUATE_NOTARY'
  | 'APPROVE_NOTARY_EXCEPTION'
  | 'FORMALIZE_CONTRACT'
  | 'COMPLETE_DELIVERY'
  | 'UPLOAD_EVIDENCE'
  | 'REQUEST_EXTENSION'
  | 'AUTHORIZE_EXTENSION'
  | 'REJECT_EXTENSION';

const OPERATIONAL_ROLES: ReadonlySet<WorkerRole> = new Set([
  'FRONT_OFFICE',
  'ADMINISTRACION',
  'GERENCIA',
]);

const RENTAL_ROLE_POLICY: Readonly<Record<RentalAction, ReadonlySet<WorkerRole>>> = {
  CREATE: OPERATIONAL_ROLES,
  READ: new Set(['FRONT_OFFICE', 'ADMINISTRACION', 'GERENCIA', 'AUDITORIA', 'FINANZAS']),
  VALIDATE_DOCUMENTS: OPERATIONAL_ROLES,
  REGISTER_ALCOHOL_TEST: OPERATIONAL_ROLES,
  EVALUATE_NOTARY: OPERATIONAL_ROLES,
  // TDD-03-alquiler.md §16 y SDD §11.2: evaluación y excepción notarial aprobable exclusivamente por Gerencia
  APPROVE_NOTARY_EXCEPTION: new Set(['GERENCIA']),
  FORMALIZE_CONTRACT: OPERATIONAL_ROLES,
  COMPLETE_DELIVERY: OPERATIONAL_ROLES,
  // Mismo rol que completar entrega: quien hace el checklist sube su evidencia.
  UPLOAD_EVIDENCE: OPERATIONAL_ROLES,
  REQUEST_EXTENSION: OPERATIONAL_ROLES,
  // BR-ALQ-012/013: autorizar/rechazar una ampliacion compromete disponibilidad de flota y garantia -> Gerencia.
  AUTHORIZE_EXTENSION: new Set(['GERENCIA']),
  REJECT_EXTENSION: new Set(['GERENCIA']),
};

export function assertRentalRoleAllowed(role: WorkerRole, action: RentalAction): void {
  if (role === 'PLATFORM_ADMIN') return;

  const allowedRoles = RENTAL_ROLE_POLICY[action];
  if (!allowedRoles || !allowedRoles.has(role)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar la accion ${action} sobre un Alquiler.`,
    });
  }
}
