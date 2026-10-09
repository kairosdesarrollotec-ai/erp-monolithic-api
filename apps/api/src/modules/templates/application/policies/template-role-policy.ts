import type { WorkerRole } from '../../../users/domain/worker-role';

export type TemplateAction = 'VIEW' | 'MANAGE';

class TemplateRoleNotAllowedError extends Error {
  constructor(role: string, action: TemplateAction) {
    super(`Rol ${role} no tiene permiso para la acción TEMPLATE.${action}`);
    this.name = 'TemplateRoleNotAllowedError';
  }
}

/**
 * TDD-TPL-ADR-004 — Política provisional de roles para el módulo Templates.
 *
 * MANAGE (crear, solicitar URL, activar): equivale a OPS_MANAGER + COMPANY_ADMIN.
 * VIEW (listar, consultar): agrega RESERVATION_AGENT + FLEET_OPERATOR + CASHIER + READ_ONLY.
 *
 * Mapping a claves de sistema vigentes (WorkerRole):
 *   OPS_MANAGER     → GERENCIA
 *   COMPANY_ADMIN   → ADMINISTRACION
 *   RESERVATION_AGENT → FRONT_OFFICE
 *   FLEET_OPERATOR  → CAMPO
 *   CASHIER         → FINANZAS
 *   READ_ONLY       → AUDITORIA
 *
 * AVISO: esta política actúa como semilla de la versión 0 del default matrix (ADM-02);
 * la autorización en tiempo de ejecución se evalúa por MatrixAuthorizationService.
 */
const TEMPLATE_MANAGE_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'PLATFORM_ADMIN',
]);

const TEMPLATE_VIEW_ROLES: ReadonlySet<WorkerRole> = new Set([
  ...TEMPLATE_MANAGE_ROLES,
  'FRONT_OFFICE',
  'CAMPO',
  'FINANZAS',
  'AUDITORIA',
]);

const TEMPLATE_ROLE_POLICY: Readonly<Record<TemplateAction, ReadonlySet<WorkerRole>>> = {
  MANAGE: TEMPLATE_MANAGE_ROLES,
  VIEW: TEMPLATE_VIEW_ROLES,
};

export function assertTemplateRoleAllowed(role: WorkerRole | null, action: TemplateAction): void {
  if (role === 'PLATFORM_ADMIN') return;

  const allowedRoles = TEMPLATE_ROLE_POLICY[action];
  if (role === null || !allowedRoles.has(role)) {
    throw new TemplateRoleNotAllowedError(role ?? 'sin clave de sistema', action);
  }
}
