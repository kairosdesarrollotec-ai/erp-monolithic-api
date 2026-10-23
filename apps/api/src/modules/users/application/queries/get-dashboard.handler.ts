import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
import { GetDashboardQuery } from './get-dashboard.query';
import type { RoleRef } from '../../domain/worker-role';
import { DashboardItemRepositoryPort } from '../../../dashboard-projections/application/ports/dashboard-item-repository.port';

export interface DashboardTaskItemResult {
  id: string;
  itemType: string;
  priority: number;
  title: string;
  detail: string | null;
  deepLink: string;
}

export type DashboardResult =
  | { role: RoleRef; state: 'EMPTY' }
  | { role: RoleRef; state: 'READY'; tasks: DashboardTaskItemResult[] };

/**
 * TR-06 (HU-24): punto de entrada del tablero por rol. Igual que TR-05
 * (BR-ORG-002; NFR-SEC-001), el companyId/branchId que llega del cliente
 * se valida siempre contra una asignacion real antes de usarlo - nunca se
 * confia en el rol que el cliente diga tener.
 *
 * Hallazgo alto de revision PR#5 ("el rol se usa para presentacion, no
 * para autorizacion" / "no usa el servicio central
 * WorkContextAuthorizationService"): este handler llamaba directamente al
 * repositorio, duplicando la politica de autorizacion que ya vive en
 * WorkContextAuthorizationService (deny-by-default, extraida en PR#4) y
 * arriesgando que TR-06 divergiera de TR-05 u otros modulos futuros. El
 * rol devuelto viene siempre de esa misma validacion (la asignacion
 * vigente resuelta por WorkContextAuthorizationService.authorize), nunca
 * de un valor enviado por el cliente ni de una segunda consulta
 * independiente al repositorio.
 *
 * Estado actual (Auditoria TR P-06, 22-oct-2026): los modulos de dominio ya publican
 * sus tareas/alertas a `dashboard_items` (proyecciones por outbox); este handler las lee
 * por rol/empresa/sede y devuelve `state: READY` con `tasks`, o `EMPTY` si no hay ninguna.
 * Antes devolvia siempre EMPTY (nota PROVISIONAL de PR#5, ya superada).
 *
 * IMPORTANTE (hallazgo ALTO de revision de seguimiento de PR#5): que
 * este handler pase por `authorization.authorize()` NO significa que
 * haya control de acceso por rol - los 7 roles llegan hoy al mismo
 * tablero (ver work-context-authorization.service.ts, seccion "LO QUE
 * ESTE SERVICIO NO ES"). El rol solo sirve para que el FRONTEND enrute a
 * la vista correcta, no para negar la respuesta de este endpoint segun
 * el rol.
 */
@Injectable()
export class GetDashboardHandler {
  constructor(
    private readonly authorization: WorkContextAuthorizationService,
    private readonly dashboardItems: DashboardItemRepositoryPort,
  ) {}

  async execute(query: GetDashboardQuery): Promise<DashboardResult> {
    const context = await this.authorization.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    // ROLES DINAMICOS: el rol viaja como RoleRef {id, name, key}. El tablero por
    // rol sigue funcionando contra `roleKey` (los 8 roles de sistema proyectan
    // sus items por clave); un rol creado a mano (key = null) no tiene tablero
    // proyectado todavia -> estado EMPTY.
    const role: RoleRef = { id: context.roleId, name: context.roleName, key: context.roleKey };
    if (context.roleKey === null) {
      return { role, state: 'EMPTY' };
    }

    const items = await this.dashboardItems.listActive({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
      role: context.roleKey,
    });

    if (items.length === 0) {
      return { role, state: 'EMPTY' };
    }

    return {
      role,
      state: 'READY',
      tasks: items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        priority: item.priority,
        title: item.title,
        detail: item.detail,
        deepLink: item.deepLink,
      })),
    };
  }
}
