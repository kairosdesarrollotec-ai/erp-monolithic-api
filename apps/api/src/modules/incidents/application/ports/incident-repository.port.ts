import type { Prisma } from '@prisma/client';
import type { IncidentActionKind, IncidentSeverity, IncidentStatus, IncidentType } from '../../domain/incident-catalog';

/**
 * Toda lectura o mutacion puntual se identifica por el scope completo (organizacion + empresa + sede), nunca solo
 * por id ni por organizacion - mismo criterio que `ReturnScope` / `InquiryScope`.
 */
export interface IncidentScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface IncidentActionRecord {
  id: string;
  incidentId: string;
  kind: IncidentActionKind;
  description: string;
  authorUserId: string;
  createdAt: Date;
}

/** Proyeccion de resumen (bandeja INC-01): sin historial. */
export interface IncidentRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  rentalId: string;
  returnId: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  suggestion: string | null;
  reportedAt: Date;
  responsibleUserId: string;
  resolutionSummary: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Detalle (INC-02): incidencia + timeline append-only en orden cronologico ascendente. */
export interface IncidentDetailRecord extends IncidentRecord {
  actions: IncidentActionRecord[];
}

export interface CreateIncidentInput extends IncidentScope {
  rentalId: string;
  returnId?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  suggestion?: string;
  reportedAt: Date;
  responsibleUserId: string;
  createdBy: string;
  /** Instante de registro: createdAt de la incidencia y de su primera entrada REPORTED. */
  now: Date;
}

export interface ListIncidentsFilter extends IncidentScope {
  type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  rentalId?: string;
  returnId?: string;
  /** Keyset real sobre (createdAt DESC, id DESC): la pagina siguiente trae filas estrictamente anteriores a este par. */
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

/**
 * Agrega UNA entrada al historial (append-only) y, opcionalmente, transiciona la incidencia desde ABIERTA.
 * Siempre incrementa `version`. Condicionado por version esperada y por estado ABIERTA.
 */
export interface AppendIncidentActionInput {
  id: string;
  scope: IncidentScope;
  expectedVersion: number;
  kind: IncidentActionKind;
  description: string;
  authorUserId: string;
  now: Date;
  nextStatus?: IncidentStatus;
  resolutionSummary?: string;
  resolvedAt?: Date;
}

export interface AppendIncidentActionResult {
  incident: IncidentDetailRecord;
  /** La entrada recien agregada (identificada sin depender del orden del timeline). */
  action: IncidentActionRecord;
}

/**
 * Puerto de persistencia de Incidencias. Las mutaciones reciben `tx` (obligatorio) para que el handler incluya
 * auditoria y outbox en la misma transaccion. No existe update/delete de entradas del historial.
 */
export abstract class IncidentRepositoryPort {
  abstract create(input: CreateIncidentInput, tx: Prisma.TransactionClient): Promise<IncidentDetailRecord>;
  abstract findById(id: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentDetailRecord | null>;
  abstract list(filter: ListIncidentsFilter): Promise<IncidentRecord[]>;
  abstract appendAction(input: AppendIncidentActionInput, tx: Prisma.TransactionClient): Promise<AppendIncidentActionResult>;
}
