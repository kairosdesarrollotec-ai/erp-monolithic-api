import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * Hallazgo ALTO de revision PR#6 ("falta autorizacion granular por
 * rol/accion") - el revisor rechazo explicitamente que esto se quede
 * solo documentado (como se hizo con WorkContextAuthorizationService en
 * PR#5): pedia una politica REAL, aunque sea provisional.
 *
 * PROVISIONAL, igual que WorkerRole (ver worker-role.ts): esta matriz NO
 * es ADM-02 (matriz rol-accion-empresa-sede versionada, con segregacion
 * de funciones y MFA para modificarla - PANTALLAS-V2-B-SOPORTE.md) -
 * ADM-02 todavia no existe como funcionalidad, solo como diseño de
 * pantalla, y no hay una persona de negocio que haya definido la matriz
 * completa y definitiva todavia. En vez de bloquear el cierre de este PR
 * esperando ese trabajo (que ademas no depende de nosotros), se codifica
 * aqui una matriz minima, deny-by-default, basada en las señales reales
 * que SI existen en la documentacion:
 * - TDD-RES-001.md sec. 16: claims `reservation:create`,
 *   `payment:register`, `reservation:cancel` existen como concepto.
 * - SDD-RES-001.md sec. 12 (OP-RES-001/002/004): actor "Administrador"
 *   para confirmar/cancelar/convertir - interpretado aqui como el
 *   personal operativo normal de una sede (FRONT_OFFICE), no
 *   necesariamente el rol WorkerRole.ADMINISTRACION en sentido estricto,
 *   pero se incluye tambien ADMINISTRACION y GERENCIA por alcance
 *   jerarquico (quien puede hacer la operacion normal, tambien puede
 *   quien lo supervisa).
 * - MATRIZ-TRAZABILIDAD-COMPLETA.md (RES-08): cancelacion por no-show
 *   "solo Gerencia" - la unica restriccion explicita y no ambigua que
 *   aparece en la documentacion, por eso CANCEL_NO_SHOW es la unica
 *   accion con un allow-list mas estrecho que el resto.
 *
 * Cuando ADM-02 exista, este archivo se reemplaza por una consulta a esa
 * matriz real - no se extiende a mano con mas casos particulares.
 *
 * READ_LIST / READ_DETAIL siguen el mismo criterio documentado que Consulta
 * (PANTALLAS-V3-B-CONSULTA.md punto 3): lectura para FRONT_OFFICE, GERENCIA,
 * AUDITORIA y ADMINISTRACION. Sin fuente que restrinja la lectura a menos
 * roles que la escritura, y sin inventar reglas nuevas.
 */
export type ReservationAction =
  | 'READ_LIST'
  | 'READ_DETAIL'
  | 'CREATE'
  | 'REGISTER_PAYMENT'
  | 'REGISTER_DOCUMENTS'
  | 'CONFIRM'
  | 'CANCEL_CUSTOMER_REQUESTED_CHANGE'
  | 'CANCEL_NO_SHOW';

const READ_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'AUDITORIA', 'ADMINISTRACION']);
const OPERATIONAL_ROLES: ReadonlySet<WorkerRole> = new Set(['FRONT_OFFICE', 'GERENCIA', 'ADMINISTRACION']);

const RESERVATION_ROLE_POLICY: Readonly<Record<ReservationAction, ReadonlySet<WorkerRole>>> = {
  READ_LIST: READ_ROLES,
  READ_DETAIL: READ_ROLES,
  CREATE: OPERATIONAL_ROLES,
  REGISTER_PAYMENT: OPERATIONAL_ROLES,
  REGISTER_DOCUMENTS: OPERATIONAL_ROLES,
  CONFIRM: OPERATIONAL_ROLES,
  CANCEL_CUSTOMER_REQUESTED_CHANGE: OPERATIONAL_ROLES,
  CANCEL_NO_SHOW: new Set(['GERENCIA']),
};

export function assertReservationRoleAllowed(role: WorkerRole, action: ReservationAction): void {
  if (role === 'PLATFORM_ADMIN') return;
  if (!RESERVATION_ROLE_POLICY[action].has(role)) {
    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      detail: `El rol ${role} no tiene permiso para realizar esta accion sobre una Reserva.`,
    });
  }
}
