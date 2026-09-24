import type { WorkerRole } from '../../../users/domain/worker-role';

export interface DashboardItemScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  role: WorkerRole;
}

export interface UpsertDashboardItemInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  role: WorkerRole;
  itemType: 'TASK' | 'ALERT' | 'DRAFT' | 'ACTIVITY';
  priority: number;
  title: string;
  detail?: string | null;
  deepLink: string;
  sourceType: string;
  sourceId: string;
  sourceEventId: string;
  expiresAt?: Date | null;
}

export interface DashboardItemRecord {
  id: string;
  itemType: string;
  priority: number;
  title: string;
  detail: string | null;
  deepLink: string;
  sourceType: string;
  sourceId: string;
  createdAt: Date;
}

/**
 * Puerto de la proyeccion de lectura de TR-06 (SDD-KAIROS-TRANSVERSAL.md
 * 18.2) - ver el modelo DashboardItem en schema.prisma y
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md (Project KAIROS)
 * para el diseno completo del agregador (TR-06/TR-07/TR-08).
 */
export abstract class DashboardItemRepositoryPort {
  /**
   * Idempotente por (sourceEventId, itemType) - reprocesar el mismo
   * evento de outbox_events (ej. tras un reinicio del relay antes de
   * marcar processedAt) no duplica el item.
   */
  abstract upsertFromEvent(input: UpsertDashboardItemInput): Promise<void>;

  /**
   * Descarta (no borra) los items de tablero de un origen determinado -
   * usado cuando una reserva pasa de "pendiente" (DRAFT) a un estado que
   * ya no requiere atencion (CONFIRMED/CANCELLED), para que el item de
   * tablero desaparezca sin perder el historial.
   */
  abstract dismissBySource(sourceType: string, sourceId: string): Promise<void>;

  abstract listActive(scope: DashboardItemScope): Promise<DashboardItemRecord[]>;
}
