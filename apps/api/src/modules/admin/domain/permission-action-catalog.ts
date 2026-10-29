/**
 * ADM-02 (Roles y permisos) - catalogo de acciones reales que ya
 * existen como policies hardcodeadas en el backend
 * (reservation-role-policy.ts, inquiry-role-policy.ts,
 * incident-role-policy.ts, admin-role-policy.ts). No se inventan acciones nuevas: la matriz de
 * ADM-02 solo puede administrar lo que el sistema ya sabe distinguir.
 */
export const PERMISSION_MODULES = ['RESERVATION', 'INQUIRY', 'ADMIN', 'RENTAL', 'INCIDENT', 'RETURN', 'FLEET', 'CUSTOMER', 'RECRUITMENT', 'TEMPLATE', 'HR_ADMINISTRATION', 'PAYMENT', 'REPORT', 'NOTIFICATIONS', 'EVIDENCE', 'SYNC'] as const;

/** Modulos cuyas acciones administra la matriz ADM-02 (unica definicion; antes estaba repetida en ~6 sitios). */
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export interface PermissionActionDescriptor {
  module: PermissionModule;
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
  { module: 'RESERVATION', action: 'FLAG_SALE', label: 'Reserva: registrar venta del vehículo reservado' },
  { module: 'RESERVATION', action: 'RESOLVE_SALE', label: 'Reserva: resolver venta (alternativa o reembolso)' },
  { module: 'RESERVATION', action: 'CONFIRM_SALE_REFUND', label: 'Reserva: confirmar transferencia del reembolso por venta (Gerencia y Finanzas)' },
  { module: 'RESERVATION', action: 'REGISTER_REMINDER', label: 'Reserva: registrar envío del recordatorio 3 h antes del recojo' },
  { module: 'RESERVATION', action: 'REQUEST_AIRPORT_SERVICE', label: 'Reserva: solicitar servicio de aeropuerto (Administración y Gerencia)' },
  { module: 'RESERVATION', action: 'CHANGE_VEHICLE', label: 'Reserva: cambiar vehículo (borrador)' },
  { module: 'INQUIRY', action: 'READ', label: 'Consulta: leer' },
  { module: 'INQUIRY', action: 'REGISTER', label: 'Consulta: registrar' },
  { module: 'INQUIRY', action: 'QUOTE', label: 'Consulta: cotizar' },
  { module: 'INQUIRY', action: 'CLOSE', label: 'Consulta: cerrar' },
  { module: 'INQUIRY', action: 'CONVERT_TO_RESERVATION', label: 'Consulta: convertir a reserva' },
  { module: 'INQUIRY', action: 'CONVERT_TO_RENTAL', label: 'Consulta: convertir a alquiler' },
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
  { module: 'RENTAL', action: 'CANCEL', label: 'Alquiler: cancelar antes de la entrega (documentos invalidos / cliente rechaza notaria)' },
  { module: 'RENTAL', action: 'REQUEST_AIRPORT_SERVICE', label: 'Alquiler: solicitar servicio de aeropuerto (Administración y Gerencia)' },
  { module: 'INCIDENT', action: 'VIEW', label: 'Incidencia: ver bandeja y detalle' },
  { module: 'INCIDENT', action: 'CREATE', label: 'Incidencia: registrar' },
  { module: 'INCIDENT', action: 'ADD_ACTION', label: 'Incidencia: agregar acción al historial' },
  { module: 'INCIDENT', action: 'RESOLVE', label: 'Incidencia: resolver (directo, solo severidad leve)' },
  { module: 'INCIDENT', action: 'CLOSE', label: 'Incidencia: cerrar' },
  { module: 'INCIDENT', action: 'REFER_LEGAL', label: 'Incidencia: derivar a vía legal' },
  { module: 'ADMIN', action: 'MANAGE_USERS', label: 'Administración: gestionar usuarios' },
  { module: 'ADMIN', action: 'VIEW_AUDIT', label: 'Administración: ver auditoría' },
  { module: 'ADMIN', action: 'MANAGE_PARAMETERS', label: 'Administración: gestionar parámetros' },
  { module: 'ADMIN', action: 'MANAGE_PERMISSIONS', label: 'Administración: gestionar permisos' },
  { module: 'ADMIN', action: 'MANAGE_NOTIFICATIONS', label: 'Administración: gestionar notificaciones' },
  // RETURN (12 acciones — return-role-policy.ts)
  { module: 'RETURN', action: 'CREATE', label: 'Devolución: crear' },
  { module: 'RETURN', action: 'READ', label: 'Devolución: leer' },
  { module: 'RETURN', action: 'RECEIVE_PROVISIONAL', label: 'Devolución: recepción provisional' },
  { module: 'RETURN', action: 'REGISTER_ALCOHOL_TEST', label: 'Devolución: registrar alcolímetro' },
  { module: 'RETURN', action: 'RESOLVE_ALCOHOL_ESCALATION', label: 'Devolución: resolver escalación alcolímetro' },
  { module: 'RETURN', action: 'COMPLETE_INSPECTION', label: 'Devolución: completar inspección' },
  { module: 'RETURN', action: 'CLASSIFY_DAMAGE_SEVERITY', label: 'Devolución: clasificar gravedad del daño (BR-DEV-007)' },
  { module: 'RETURN', action: 'ASSESS_DAMAGE', label: 'Devolución: valorar daño' },
  { module: 'RETURN', action: 'CHARGE_IMMOBILIZATION', label: 'Devolución: cobrar inmovilización' },
  { module: 'RETURN', action: 'CLOSE_FINANCIAL', label: 'Devolución: cierre financiero' },
  { module: 'RETURN', action: 'CLOSE', label: 'Devolución: cerrar devolución' },
  { module: 'RETURN', action: 'UPLOAD_EVIDENCE', label: 'Devolución: subir evidencia' },
  // FLEET (3 acciones — fleet-role.policy.ts)
  { module: 'FLEET', action: 'READ', label: 'Flota: consultar vehículos' },
  { module: 'FLEET', action: 'WRITE', label: 'Flota: crear/editar vehículos' },
  { module: 'FLEET', action: 'CROSS_BRANCH', label: 'Flota: operar en sedes distintas' },
  { module: 'FLEET', action: 'MANAGE_THIRD_PATH', label: 'Flota: marcar vehiculo de menor costo elegible para la tercera via notarial (solo Gerencia)' },
  { module: 'FLEET', action: 'REGISTER_VEHICLE_OPERATIONAL_FORMAT', label: 'Flota: registrar fichas operativas (Formatos 01 al 09)' },
  { module: 'FLEET', action: 'VIEW_VEHICLE_OPERATIONAL_FORMAT', label: 'Flota: consultar fichas operativas y recordatorios' },
  // CUSTOMER (2 acciones — customer-role.policy.ts)
  { module: 'CUSTOMER', action: 'READ', label: 'Clientes: consultar' },
  { module: 'CUSTOMER', action: 'WRITE', label: 'Clientes: crear/editar' },
  // RECRUITMENT (12 acciones — recruitment-role-policy.ts)
  { module: 'RECRUITMENT', action: 'VIEW_VACANCY', label: 'Reclutamiento: ver vacante' },
  { module: 'RECRUITMENT', action: 'CREATE_VACANCY', label: 'Reclutamiento: registrar necesidad de vacante' },
  { module: 'RECRUITMENT', action: 'PUBLISH_VACANCY', label: 'Reclutamiento: publicar vacante' },
  { module: 'RECRUITMENT', action: 'REGISTER_CANDIDATE', label: 'Reclutamiento: registrar postulante' },
  { module: 'RECRUITMENT', action: 'VIEW_CANDIDATE', label: 'Reclutamiento: ver postulante' },
  { module: 'RECRUITMENT', action: 'VIEW_CANDIDATE_SENSITIVE_DATA', label: 'Reclutamiento: ver datos sensibles de postulante' },
  { module: 'RECRUITMENT', action: 'MANAGE_INTERVIEW', label: 'Reclutamiento: gestionar entrevista' },
  { module: 'RECRUITMENT', action: 'DECIDE_CANDIDATE', label: 'Reclutamiento: decidir contratación' },
  { module: 'RECRUITMENT', action: 'MANAGE_ONBOARDING', label: 'Reclutamiento: gestionar incorporación' },
  { module: 'RECRUITMENT', action: 'EVALUATE_PROBATION', label: 'Reclutamiento: evaluar periodo de prueba' },
  { module: 'RECRUITMENT', action: 'DECIDE_NO_ADVANCE', label: 'Reclutamiento: decidir «No avanza» tras la entrevista (solo Gerencia)' },
  { module: 'RECRUITMENT', action: 'TERMINATE_PROBATION', label: 'Reclutamiento: registrar término tras prueba negativa (solo Gerencia)' },
  { module: 'RECRUITMENT', action: 'CANCEL_VACANCY', label: 'Reclutamiento: cancelar vacante (motivo obligatorio)' },
  // TEMPLATE (2 acciones — TDD-KAIROS-MVP-002-TPL TDD-TPL-ADR-004)
  { module: 'TEMPLATE', action: 'VIEW', label: 'Plantillas: consultar' },
  { module: 'TEMPLATE', action: 'MANAGE', label: 'Plantillas: crear/activar/retirar' },
  // HR_ADMINISTRATION (12 acciones — hr-administration-role-policy.ts)
  { module: 'HR_ADMINISTRATION', action: 'VIEW_EMPLOYEES', label: 'Personal: consultar colaboradores y expedientes' },
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_EMPLOYEES', label: 'Personal: crear y editar colaboradores' },
  { module: 'HR_ADMINISTRATION', action: 'LOG_ATTENDANCE', label: 'Personal: registrar asistencia y faltas' },
  { module: 'HR_ADMINISTRATION', action: 'AUTHORIZE_LEAVE', label: 'Personal: autorizar permisos y salidas antes de hora' },
  { module: 'HR_ADMINISTRATION', action: 'SCHEDULE_VACATION', label: 'Personal: programar vacaciones' },
  { module: 'HR_ADMINISTRATION', action: 'REQUEST_FIELD_TRIP', label: 'Personal: solicitar salida a campo' },
  { module: 'HR_ADMINISTRATION', action: 'AUTHORIZE_FIELD_TRIP', label: 'Personal: autorizar salida a campo en cascada' },
  { module: 'HR_ADMINISTRATION', action: 'EVALUATE_FIELD_TRIP_RETURN', label: 'Personal: evaluar retorno de campo y tardanzas' },
  { module: 'HR_ADMINISTRATION', action: 'TERMINATE_EMPLOYMENT', label: 'Personal: registrar término de relación laboral' },
  { module: 'HR_ADMINISTRATION', action: 'REGISTER_TRAINING', label: 'Personal: registrar capacitaciones internas' },
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_AREAS', label: 'Personal: dar de alta y desactivar áreas (solo Gerencia)' },
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_SALARY', label: 'Personal: editar el sueldo base de la ficha (solo Gerencia)' },
  // Respuestas 2026-10-22 #9 (asistencia con autoservicio y control) y HU-35 (dato personal)
  { module: 'HR_ADMINISTRATION', action: 'LOG_OWN_ATTENDANCE', label: 'Personal: marcar la propia asistencia desde la cuenta personal (foto y ubicación)' },
  { module: 'HR_ADMINISTRATION', action: 'REVIEW_ATTENDANCE', label: 'Personal: aprobar o corregir marcas de asistencia fuera de la geocerca' },
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_GEOFENCE', label: 'Personal: configurar la geocerca (coordenadas y radio) de cada sede' },
  { module: 'HR_ADMINISTRATION', action: 'VIEW_EMPLOYEE_DOCUMENT', label: 'Personal: ver el número de documento (DNI) del colaborador' },
  // HU-31 y HU-35 (23-oct-2026, Frente R6)
  { module: 'HR_ADMINISTRATION', action: 'VIEW_EMPLOYEE_SENSITIVE_DATA', label: 'Personal: ver datos personales sensibles del colaborador (DNI, sueldo base, contrato y cuenta bancaria; solo Gerencia por defecto)' },
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_HR_DOCUMENTS', label: 'Personal: publicar y versionar reglamentos, políticas y formatos de Talento Humano (solo Gerencia)' },
  { module: 'HR_ADMINISTRATION', action: 'VIEW_HR_DOCUMENTS', label: 'Personal: consultar reglamentos, políticas y formatos vigentes de Talento Humano' },
  { module: 'HR_ADMINISTRATION', action: 'CONFIRM_HR_DOCUMENT_READ', label: 'Personal: registrar la confirmación de lectura de documentos de Talento Humano' },
  // REC-P13 / BDD-05 / BDD-00 (Documento de expectativas a los 2 días de ingreso)
  { module: 'HR_ADMINISTRATION', action: 'MANAGE_EXPECTATION_DOCUMENT', label: 'Personal: gestionar documento de expectativas del colaborador (por defecto RRHH y Gerencia)' },
  // PAYMENT (5 acciones — BDD-PAG-001 / SDD-PAG-001 / TDD-PAG-001)
  { module: 'PAYMENT', action: 'READ_LIST', label: 'Pagos: listar garantías de alquiler' },
  { module: 'PAYMENT', action: 'READ_DETAIL', label: 'Pagos: ver detalle de garantía y ajustes' },
  { module: 'PAYMENT', action: 'REGISTER_ADJUSTMENT', label: 'Pagos: registrar ajuste de garantía' },
  { module: 'PAYMENT', action: 'APPROVE_REFUND', label: 'Pagos: aprobar devolución de garantía' },
  { module: 'PAYMENT', action: 'CLOSE_FINANCIAL', label: 'Pagos: cerrar expediente financiero' },
  // REPORT (3 acciones — BDD-REP-001 / SDD-REP-001 / TDD-REP-001)
  { module: 'REPORT', action: 'READ_OPERATIONAL', label: 'Reportes: ver KPIs operativos' },
  { module: 'REPORT', action: 'READ_FINANCIAL', label: 'Reportes: ver KPIs financieros' },
  { module: 'REPORT', action: 'EXPORT', label: 'Reportes: exportar datos (CSV)' },
  // NOTIFICATIONS (1 accion — Respuestas 2026-10-20 #8: alertas de devolucion a quien tenga permiso de notificacion, no solo Finanzas)
  { module: 'NOTIFICATIONS', action: 'RECEIVE_RETURN_ALERTS', label: 'Notificaciones: recibir alertas de devolución en el tablero (garantía 24 h, cargo por retraso, inmovilización)' },
  // Respuestas 2026-10-22 #4: la cascada de salidas a campo y las terminaciones/vacantes las recibe Gerencia General (editable en ADM-02)
  { module: 'NOTIFICATIONS', action: 'RECEIVE_FIELD_TRIP_ALERTS', label: 'Notificaciones: recibir alertas de salidas a campo (solicitud, escalada de nivel, nadie autorizó)' },
  { module: 'NOTIFICATIONS', action: 'RECEIVE_HR_ALERTS', label: 'Notificaciones: recibir alertas de Talento Humano (terminación laboral, vacante creada, paso a planilla)' },
  // EVIDENCE (3 acciones — DEC-EVID-DELETE-002, Respuestas 2026-10-20 #35: doble aprobación para eliminar evidencia, SDD §15.5)
  { module: 'EVIDENCE', action: 'REQUEST_DELETION', label: 'Evidencia: solicitar eliminación (motivo obligatorio)' },
  { module: 'EVIDENCE', action: 'APPROVE_DELETION', label: 'Evidencia: aprobar o rechazar solicitudes de eliminación' },
  { module: 'EVIDENCE', action: 'DELETE_DIRECT', label: 'Evidencia: eliminar directo sin doble aprobación (DEPRECADO, solo administrador de plataforma)' },
  // SYNC (1 accion — Respuesta de negocio 2026-10-22: supervisor de sincronizacion = Administracion + Gerencia)
  { module: 'SYNC', action: 'SUPERVISE_CONFLICTS', label: 'Sincronización: resolver conflictos de checklists offline (supervisor: Administración y Gerencia)' },
];

/**
 * Segregacion de funciones (contrato ADM-02 punto 8): "ciertas
 * combinaciones de permisos incompatibles no se permiten a la vez".
 *
 * La documentacion (PANTALLAS-V2-B-SOPORTE.md) solo da un ejemplo ("quien
 * aprueba tambien ejecuta el mismo pago") y el negocio NO ha definido pares
 * concretos. El par provisional REGISTER_PAYMENT + CONFIRM de Reserva se
 * retiro (29-oct): en el proceso real Front Office registra el pago y confirma,
 * y las politicas por defecto de Administracion, Front Office y Gerencia ya
 * tienen ambos permisos, por lo que impedia guardar la matriz. El mecanismo de
 * validacion queda intacto: se agregan pares aqui cuando el negocio los defina.
 */
export const INCOMPATIBLE_ACTION_PAIRS: [string, string][] = [];

export function actionKey(module: PermissionActionDescriptor['module'], action: string): string {
  return `${module}.${action}`;
}
