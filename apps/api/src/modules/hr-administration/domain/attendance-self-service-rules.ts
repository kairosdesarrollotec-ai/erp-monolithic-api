import {
  AttendanceCaptureTooOldError,
  AttendanceLocationRequiredError,
  AttendanceReasonRequiredError,
  InvalidAttendanceRecordError,
  InvalidGeofenceError,
} from './hr-administration-errors';

/**
 * 22-oct (Respuestas Russbel #9): autoservicio de asistencia con foto + ubicacion obligatoria + geocerca por sede.
 * Reglas puras (sin I/O) para poder probarlas sin base de datos.
 */

/** Antiguedad maxima de `capturedAt` (marcas offline). PROPUESTO: 24 h. */
export const ATTENDANCE_MAX_CAPTURE_AGE_MS = 24 * 60 * 60 * 1000;
/** Tolerancia de reloj del dispositivo hacia el futuro. */
export const ATTENDANCE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const GEOFENCE_MIN_RADIUS_METERS = 10;
export const GEOFENCE_MAX_RADIUS_METERS = 5000;

export const ATTENDANCE_REASON_MIN_LENGTH = 3;
export const ATTENDANCE_REASON_MAX_LENGTH = 500;

/** Estados que el propio colaborador puede marcar (las faltas y permisos los registra Personal). */
export const SELF_ATTENDANCE_STATUSES: readonly string[] = ['PRESENTE', 'TARDANZA'];

export type AttendanceReviewStatus = 'PENDING' | 'APPROVED' | 'CORRECTED';
export type AttendanceSource = 'SELF' | 'ON_BEHALF';

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Distancia ortodromica (haversine) en metros entre dos puntos WGS84. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BranchGeofence {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
}

export function isGeofenceConfigured(g: BranchGeofence | null | undefined): g is {
  latitude: number;
  longitude: number;
  radiusMeters: number;
} {
  return !!g && g.latitude !== null && g.longitude !== null && g.radiusMeters !== null;
}

export interface GeofenceEvaluation {
  /** false si la sede no tiene geocerca: la marca se acepta sin evaluar (PROPUESTO). */
  evaluated: boolean;
  outsideGeofence: boolean;
  distanceMeters: number | null;
  radiusMeters: number | null;
}

/** Fuera de rango = distancia > radio (el borde cuenta como dentro). No se descuenta la precision del GPS. */
export function evaluateGeofence(point: GeoPoint, geofence: BranchGeofence | null | undefined): GeofenceEvaluation {
  if (!isGeofenceConfigured(geofence)) {
    return { evaluated: false, outsideGeofence: false, distanceMeters: null, radiusMeters: null };
  }
  const distance = haversineMeters(point, geofence);
  return {
    evaluated: true,
    outsideGeofence: distance > geofence.radiusMeters,
    distanceMeters: Math.round(distance * 10) / 10,
    radiusMeters: geofence.radiusMeters,
  };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Valida coordenadas y radio de una geocerca; lanza 422 INVALID_GEOFENCE. */
export function assertValidGeofence(input: { latitude: unknown; longitude: unknown; radiusMeters: unknown }): void {
  if (!finite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new InvalidGeofenceError('latitude debe estar entre -90 y 90.');
  }
  if (!finite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new InvalidGeofenceError('longitude debe estar entre -180 y 180.');
  }
  if (
    !finite(input.radiusMeters) ||
    !Number.isInteger(input.radiusMeters) ||
    input.radiusMeters < GEOFENCE_MIN_RADIUS_METERS ||
    input.radiusMeters > GEOFENCE_MAX_RADIUS_METERS
  ) {
    throw new InvalidGeofenceError(
      `radiusMeters debe ser un entero entre ${GEOFENCE_MIN_RADIUS_METERS} y ${GEOFENCE_MAX_RADIUS_METERS}.`,
    );
  }
}

export interface SelfLocationInput {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
}

/** La ubicacion es OBLIGATORIA en la marca propia (#9). 422 ATTENDANCE_LOCATION_REQUIRED / INVALID_ATTENDANCE_RECORD. */
export function assertSelfLocation(
  loc: SelfLocationInput | null | undefined,
): { latitude: number; longitude: number; accuracy: number } {
  if (!loc || !finite(loc.latitude) || !finite(loc.longitude) || !finite(loc.accuracy)) {
    throw new AttendanceLocationRequiredError();
  }
  if (loc.latitude < -90 || loc.latitude > 90) throw new InvalidAttendanceRecordError('latitude debe estar entre -90 y 90.');
  if (loc.longitude < -180 || loc.longitude > 180) {
    throw new InvalidAttendanceRecordError('longitude debe estar entre -180 y 180.');
  }
  if (loc.accuracy < 0 || loc.accuracy > 100000) {
    throw new InvalidAttendanceRecordError('accuracy debe estar entre 0 y 100000 metros.');
  }
  return { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy };
}

/** `capturedAt` (hora del dispositivo): no futura (+tolerancia) ni mas antigua que el tope offline. */
export function assertCapturedAtAcceptable(capturedAt: Date, now: Date): void {
  if (Number.isNaN(capturedAt.getTime())) {
    throw new InvalidAttendanceRecordError('capturedAt no es una fecha y hora válida.');
  }
  const delta = now.getTime() - capturedAt.getTime();
  if (delta < -ATTENDANCE_FUTURE_TOLERANCE_MS) {
    throw new InvalidAttendanceRecordError('capturedAt no puede estar en el futuro.');
  }
  if (delta > ATTENDANCE_MAX_CAPTURE_AGE_MS) {
    throw new AttendanceCaptureTooOldError(ATTENDANCE_MAX_CAPTURE_AGE_MS / 3_600_000);
  }
}

/** Registro «a nombre de» otro colaborador: motivo obligatorio en PRESENTE/TARDANZA (PROPUESTO: las faltas/permisos no lo exigen). */
export function resolveOnBehalfReason(status: string, reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() || null;
  if (!SELF_ATTENDANCE_STATUSES.includes(status)) return trimmed;
  if (!trimmed || trimmed.length < ATTENDANCE_REASON_MIN_LENGTH || trimmed.length > ATTENDANCE_REASON_MAX_LENGTH) {
    throw new AttendanceReasonRequiredError();
  }
  return trimmed;
}
