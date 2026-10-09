import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Política de roles para seed y tests del módulo Clientes (PR #59, fase 4 completada).
 *
 * AVISO: esta política ya NO controla la autorización en tiempo de ejecución.
 * Los handlers usan CustomerAccessService → MatrixAuthorizationService (ADM-02).
 * Este archivo existe únicamente para:
 *   1. Seed del default-role-permission-matrix (admin/domain/).
 *   2. Mock de autorización en test-fixtures (testing/customer-test-fixtures.ts).
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
