import type { WorkerRole } from '../../../users/domain/worker-role';
import type { ReturnDashboardItemInput } from '../../domain/return-dashboard-alerts';
import type { ReturnRecord } from './return-repository.port';

export interface ActiveWarrantyDashboardItem {
  id: string;
  /** returnId. */
  sourceId: string;
  /** Clave natural `return-warranty:<NIVEL>:<returnId>[:<ROL>]`. */
  sourceEventId: string;
  /** Destinatario del item y su alcance: la conciliacion lo descarta si el rol ya no tiene el permiso de alertas. */
  role: WorkerRole;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

/**
 * DEC-DEVREM-002 - Puerto del proceso del sistema (sin usuario, transversal a tenants) que proyecta la alerta de garantía de
 * 24 h al tablero. Escribe en `dashboard_items` (mecanismo existente de TR-06), sin canales nuevos.
 */
export abstract class ReturnDashboardAlertPort {
  /** Devoluciones SIN_DANOS recibidas en o antes de `receivedBefore`, paginadas por id (cursor). */
  abstract listWarrantyCandidates(receivedBefore: Date, limit: number, afterId?: string): Promise<ReturnRecord[]>;
  /** Idempotente: la unicidad (source_event_id, item_type) descarta duplicados. Devuelve las filas realmente creadas. */
  abstract createDashboardItems(items: readonly ReturnDashboardItemInput[]): Promise<number>;
  /** Items de garantía aún activos (no descartados), paginados por id (cursor). */
  abstract listActiveWarrantyItems(limit: number, afterId?: string): Promise<ActiveWarrantyDashboardItem[]>;
  abstract findReturnsByIds(ids: readonly string[]): Promise<ReturnRecord[]>;
  /** Descarta (no borra) por id; idempotente (solo los aún activos). Devuelve los realmente descartados. */
  abstract dismissItems(ids: readonly string[], at: Date): Promise<number>;
}
