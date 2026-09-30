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

export function assertCustomerWrite(role: WorkerRole): void {
  if (!CUSTOMER_WRITE_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CUSTOMER_WRITE_NOT_ALLOWED',
      detail: `El rol "${role}" no tiene permiso para modificar clientes.`,
    });
  }
}

export function assertCustomerRead(role: WorkerRole): void {
  if (!CUSTOMER_READ_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CUSTOMER_READ_NOT_ALLOWED',
      detail: `El rol "${role}" no tiene permiso para consultar clientes.`,
    });
  }
}
