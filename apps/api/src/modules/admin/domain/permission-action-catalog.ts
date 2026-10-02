/**
 * ADM-02 (Roles y permisos) - catalogo de acciones reales que ya
 * existen como policies hardcodeadas en el backend
 * (reservation-role-policy.ts, inquiry-role-policy.ts,
 * admin-role-policy.ts). No se inventan acciones nuevas: la matriz de
 * ADM-02 solo puede administrar lo que el sistema ya sabe distinguir.
 */
export interface PermissionActionDescriptor {
  module: 'RESERVATION' | 'INQUIRY' | 'ADMIN' | 'RENTAL';
  action: string;
  label: string;
}

export const PERMISSION_ACTION_CATALOG: readonly PermissionActionDescriptor[] = [
  { module: 'RESERVATION', action: 'READ_LIST', label: 'Reserva: listar bandeja' },
  { module: 'RESERVATION', action: 'READ_DETAIL', label: 'Reserva: ver detalle' },
  { module: 'RESERVATION', action: 'CREATE', label: 'Reserva: crear' },
  { module: 'RESERVATION', action: 'REGISTER_PAYMENT', label: 'Reserva: registrar pago' },
  { module: 'RESERVATION', action: 'REGISTER_DOCUMENTS', label: 'Reserva: registrar documentos' },
  { module: 'RESERVATION', action: 'CONFIRM', label: 'Reserva: confirmar' },
  { module: 'RESERVATION', action: 'CANCEL_CUSTOMER_REQUESTED_CHANGE', label: 'Reserva: cancelar (cambio solicitado)' },
  { module: 'RESERVATION', action: 'CANCEL_NO_SHOW', label: 'Reserva: cancelar (no-show)' },
  { module: 'INQUIRY', action: 'READ', label: 'Consulta: leer' },
  { module: 'INQUIRY', action: 'REGISTER', label: 'Consulta: registrar' },
  { module: 'INQUIRY', action: 'QUOTE', label: 'Consulta: cotizar' },
  { module: 'INQUIRY', action: 'CLOSE', label: 'Consulta: cerrar' },
  { module: 'INQUIRY', action: 'CONVERT_TO_RESERVATION', label: 'Consulta: convertir a reserva' },
  { module: 'RENTAL', action: 'CREATE', label: 'Alquiler: crear' },
  { module: 'RENTAL', action: 'READ', label: 'Alquiler: leer' },
  { module: 'RENTAL', action: 'VALIDATE_DOCUMENTS', label: 'Alquiler: validar documentos' },
  { module: 'RENTAL', action: 'REGISTER_ALCOHOL_TEST', label: 'Alquiler: registrar alcolímetro' },
  { module: 'RENTAL', action: 'EVALUATE_NOTARY', label: 'Alquiler: evaluar notaría' },
  { module: 'RENTAL', action: 'APPROVE_NOTARY_EXCEPTION', label: 'Alquiler: aprobar excepción notarial' },
  { module: 'RENTAL', action: 'FORMALIZE_CONTRACT', label: 'Alquiler: formalizar contrato' },
  { module: 'RENTAL', action: 'COMPLETE_DELIVERY', label: 'Alquiler: completar entrega' },
  { module: 'RENTAL', action: 'UPLOAD_EVIDENCE', label: 'Alquiler: subir evidencia de entrega' },
  { module: 'RENTAL', action: 'REQUEST_EXTENSION', label: 'Alquiler: solicitar ampliacion' },
  { module: 'RENTAL', action: 'AUTHORIZE_EXTENSION', label: 'Alquiler: autorizar ampliacion' },
  { module: 'RENTAL', action: 'REJECT_EXTENSION', label: 'Alquiler: rechazar ampliacion' },
  { module: 'RENTAL', action: 'MANAGE_CONTRACT_TEMPLATES', label: 'Alquiler: gestionar plantillas de contrato' },
  { module: 'RENTAL', action: 'REPORT_EXTENSION_BREACH', label: 'Alquiler: registrar falta grave de ampliacion' },
  { module: 'ADMIN', action: 'MANAGE_USERS', label: 'Administración: gestionar usuarios' },
  { module: 'ADMIN', action: 'VIEW_AUDIT', label: 'Administración: ver auditoría' },
  { module: 'ADMIN', action: 'MANAGE_PARAMETERS', label: 'Administración: gestionar parámetros' },
  { module: 'ADMIN', action: 'MANAGE_PERMISSIONS', label: 'Administración: gestionar permisos' },
  { module: 'ADMIN', action: 'MANAGE_NOTIFICATIONS', label: 'Administración: gestionar notificaciones' },
];

/**
 * Segregacion de funciones (contrato ADM-02 punto 8): "ciertas
 * combinaciones de permisos incompatibles no se permiten a la vez".
 *
 * PROVISIONAL/ilustrativo: la documentacion (PANTALLAS-V2-B-SOPORTE.md)
 * da como ejemplo "quien aprueba tambien ejecuta el mismo pago", pero
 * esa distincion (aprobar vs. ejecutar un pago) no existe todavia como
 * 2 acciones separadas en el backend - solo existe REGISTER_PAYMENT
 * (registrar) y CONFIRM (que depende de que el pago ya este validado).
 * Se usa ese mismo par como el candidato mas cercano a un control
 * maker-checker real, dejando el mecanismo de validacion listo para
 * cuando el negocio defina la regla definitiva.
 */
export const INCOMPATIBLE_ACTION_PAIRS: readonly [string, string][] = [
  ['RESERVATION.REGISTER_PAYMENT', 'RESERVATION.CONFIRM'],
];

export function actionKey(module: PermissionActionDescriptor['module'], action: string): string {
  return `${module}.${action}`;
}
