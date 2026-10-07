import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * PROVISIONAL: guarda de roles minima para el modulo de Clientes mientras
 * ADM-02 (matriz rol-accion-empresa-sede versionada) no exista.
 *
 * Fuente autorizada: SDD-KAIROS-TRANSVERSAL.md §15.5.
 *   - FRONT_OFFICE = Reservation Agent — crea y consulta clientes para consultas/reservas.
 *   - GERENCIA     = Operations Manager — aprobaciones operativas.
 *   - ADMINISTRACION = Company Administrator.
 *   - PLATFORM_ADMIN — acceso operativo provisional.
 *   - CAMPO        = Fleet Operator — necesita leer clientes para verificar en entrega.
 */
const CUSTOMER_WRITE_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'FRONT_OFFICE',
  'PLATFORM_ADMIN',
]);

const CUSTOMER_READ_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'CAMPO',
  'FRONT_OFFICE',
  'FINANZAS',
  'AUDITORIA',
  'PLATFORM_ADMIN',
]);

/**
 * TODO(roles-dinamicos, fase 4): este modulo AUN decide con un set de roles
 * hard-coded, ahora contra `roleKey` (clave estable de los 8 roles de sistema,
 * AuthorizedWorkContext.roleKey). Un rol creado a mano (key = null) queda
 * DENEGADO aqui (deny-by-default) hasta que el modulo migre a la matriz ADM-02
 * (MatrixAuthorizationService.assertAllowed por roleId) en su propio PR de la
 * fase 4. No migrar en el PR de la fase 2.
 */
export function assertCustomerWrite(role: WorkerRole | null): void {
  if (role === null || !CUSTOMER_WRITE_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CUSTOMER_WRITE_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no tiene permiso para modificar clientes.`,
    });
  }
}

export function assertCustomerRead(role: WorkerRole | null): void {
  if (role === null || !CUSTOMER_READ_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CUSTOMER_READ_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no tiene permiso para consultar clientes.`,
    });
  }
}
