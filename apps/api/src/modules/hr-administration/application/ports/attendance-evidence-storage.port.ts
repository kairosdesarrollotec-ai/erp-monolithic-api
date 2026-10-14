import type { AttendanceEvidenceContentType } from '../../domain/hr-administration-rules';

/**
 * Puerto de almacenamiento de la foto de asistencia (DEC-ADP-ATT-EVIDENCE-002). Mismo patrón que la evidencia de
 * permisos y las fotos de Flota: URL firmada de subida directa a GCS; `storageRef` es la clave del objeto.
 */
export abstract class AttendanceEvidenceStoragePort {
  abstract generateSignedUploadUrl(params: {
    companyId: string;
    employeeId: string;
    contentType: AttendanceEvidenceContentType;
  }): Promise<{ uploadUrl: string; objectUrl: string; storageRef: string; expiresAt: Date }>;
}
