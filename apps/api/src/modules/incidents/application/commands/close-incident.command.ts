import type { ManagementDecisionOutcome } from '../../domain/incident-catalog';

export class CloseIncidentCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly resolutionSummary: string,
    /** Resultado estructurado de la decision de Gerencia (obligatorio para UNAUTHORIZED_DRIVER). */
    public readonly decision?: ManagementDecisionOutcome,
  ) {}
}
