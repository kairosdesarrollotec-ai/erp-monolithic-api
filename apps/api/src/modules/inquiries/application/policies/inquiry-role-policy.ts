import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Hallazgo ALTO de revalidacion PR#7 ("RBAC pendiente": asignacion de
 * contexto no equivale a autorizacion rol-accion). Politica REAL,
 * deny-by-default, mismo patron que `reservation-role-policy.ts` (PR#6).
 *
 * PROVISIONAL hasta ADM-02 (Roles y permisos): no es la matriz versionada
 * rol-accion-empresa-sede definitiva. Se codifica SOLO lo que la
 * documentacion dice explicitamente para Consulta - PANTALLAS-V3-B-CONSULTA.md
 * punto 3 ("Roles y alcance"):
 *   - CON-01: "Front-office (gestiona), Gerencia/Auditoria (lectura),
 *     Administracion (configura)".
 *   - CON-02 / CON-03: "Front-office".
 *   - CON-04: "Front-office (decide), Gerencia/Auditoria (lectura)".
 * TDD-CON-001.md 16 nombra los permisos `inquiry:create`, `inquiry:read`,
 * `inquiry:update`.
 *
 * Por eso, a diferencia de Reserva, las escrituras de Consulta quedan
 * SOLO para FRONT_OFFICE (la documentacion asigna a Gerencia/Auditoria
 * explicitamente lectura, no gestion). Administracion "configura" pero no
 * gestiona consultas: se le da lectura, no escritura. Cualquier otro rol
 * (CAMPO, FINANZAS, RRHH) queda denegado por defecto.
 */
export type InquiryAction = 'READ' | 'REGISTER' | 'QUOTE' | 'CLOSE' | 'CONVERT_TO_RESERVATION' | 'CONVERT_TO_RENTAL';

const WRITE_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE']);
const READ_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'AUDITORIA', 'ADMINISTRACION']);

const INQUIRY_ROLE_POLICY: Readonly<Record<InquiryAction, ReadonlySet<WorkerRole>>> = {
  READ: READ_ROLES,
  REGISTER: WRITE_ROLES,
  QUOTE: WRITE_ROLES,
  CLOSE: WRITE_ROLES,
  CONVERT_TO_RESERVATION: WRITE_ROLES,
  CONVERT_TO_RENTAL: WRITE_ROLES,
};

// ROLES DINAMICOS (fase 2): esta politica ya NO decide en runtime; solo SIEMBRA la version 0 de la matriz ADM-02
// (key de rol de sistema -> role_id). Sin atajo PLATFORM_ADMIN: su "todo permitido" es una fila sembrada.
export function isInquiryRoleAllowed(role: WorkerRole, action: InquiryAction): boolean {
  return INQUIRY_ROLE_POLICY[action]?.has(role) ?? false;
}

export function assertInquiryRoleAllowed(role: WorkerRole, action: InquiryAction): void {
  if (!isInquiryRoleAllowed(role, action)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar esta accion sobre una Consulta.`,
    });
  }
}
