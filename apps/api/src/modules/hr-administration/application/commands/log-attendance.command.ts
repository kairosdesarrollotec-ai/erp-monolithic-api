import type { AttendanceStatus } from '@prisma/client';

/** DEC-ADP-ATT-EVIDENCE-001: la asistencia NO es biometrica; se corrobora con una foto (reloj + hora + rostro) enviada al grupo de WhatsApp. */
export const ATTENDANCE_EVIDENCE_KINDS = ['WHATSAPP_PHOTO'] as const;
export type AttendanceEvidenceKind = (typeof ATTENDANCE_EVIDENCE_KINDS)[number];

export interface AttendanceEvidenceInput {
  kind: AttendanceEvidenceKind;
  /** Referencia interna al objeto almacenado (p. ej. ruta GCS). Al menos uno de storageRef/url. */
  storageRef?: string | null;
  url?: string | null;
  /** Fecha y hora de la foto tal como se ve en el reloj (America/Lima si no trae offset). */
  capturedAtLocal: Date;
  note?: string | null;
}

/** HU-29: ubicacion automatica opcional (WGS84). Si viene, latitud y longitud van juntas; la precision es opcional. */
export interface AttendanceLocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export class LogAttendanceCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly date: Date,
    public readonly status: AttendanceStatus,
    public readonly minutesLate?: number | null,
    public readonly deductionAmount?: number | null,
    public readonly checkInTime?: Date | null,
    public readonly checkOutTime?: Date | null,
    public readonly notes?: string | null,
    public readonly evidence?: AttendanceEvidenceInput | null,
    public readonly location?: AttendanceLocationInput | null,
  ) {}
}
