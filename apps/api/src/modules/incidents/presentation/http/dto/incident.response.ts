import type { IncidentActionKind, IncidentSeverity, IncidentStatus, IncidentType } from '../../../domain/incident-catalog';

export interface IncidentActionEntryResponse {
  id: string;
  kind: IncidentActionKind;
  description: string;
  authorUserId: string;
  createdAt: string;
}

/** Contrato incidents.yaml: IncidentResponse (fila de la bandeja INC-01). */
export interface IncidentResponse {
  id: string;
  companyId: string;
  branchId: string;
  rentalId: string;
  /** Codigo legible del expediente: hoy el Alquiler no tiene codigo propio, por eso siempre null. */
  rentalCode: string | null;
  returnId: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  suggestion: string | null;
  reportedAt: string;
  responsibleUserId: string;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Contrato incidents.yaml: IncidentDetailResponse (INC-02) = IncidentResponse + timeline append-only ascendente. */
export interface IncidentDetailResponse extends IncidentResponse {
  actions: IncidentActionEntryResponse[];
}
