import type { LeaveEvidenceContentType } from '../../domain/hr-administration-rules';

/**
 * Puerto de almacenamiento de la evidencia adjunta de permisos (ADP-04). Mismo patrón que la evidencia de
 * Devoluciones/Alquileres: URL firmada de subida (2 pasos: pedir URL -> subir directo -> registrar el objeto).
 */
export abstract class LeaveEvidenceStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    leaveId: string;
    contentType: LeaveEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }>;
}
