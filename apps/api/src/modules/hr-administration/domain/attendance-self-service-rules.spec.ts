import {
  ATTENDANCE_MAX_CAPTURE_AGE_MS,
  assertCapturedAtAcceptable,
  assertSelfLocation,
  assertValidGeofence,
  evaluateGeofence,
  haversineMeters,
  isGeofenceConfigured,
  resolveOnBehalfReason,
} from './attendance-self-service-rules';
import {
  AttendanceCaptureTooOldError,
  AttendanceLocationRequiredError,
  AttendanceReasonRequiredError,
  InvalidAttendanceRecordError,
  InvalidGeofenceError,
} from './hr-administration-errors';

const SEDE = { latitude: -12.0464, longitude: -77.0428 };

describe('geocerca de asistencia (#9)', () => {
  it('haversine: 0 m en el mismo punto y ~111 km por grado de latitud', () => {
    expect(haversineMeters(SEDE, SEDE)).toBeCloseTo(0, 5);
    const d = haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('sin geocerca configurada la marca se acepta sin evaluar', () => {
    expect(evaluateGeofence(SEDE, null)).toEqual({
      evaluated: false,
      outsideGeofence: false,
      distanceMeters: null,
      radiusMeters: null,
    });
    expect(isGeofenceConfigured({ latitude: 1, longitude: 1, radiusMeters: null })).toBe(false);
  });

  it('dentro del radio no requiere revision; fuera si', () => {
    const fence = { ...SEDE, radiusMeters: 100 };
    const near = evaluateGeofence({ latitude: SEDE.latitude + 0.0005, longitude: SEDE.longitude }, fence); // ~55 m
    expect(near.evaluated).toBe(true);
    expect(near.outsideGeofence).toBe(false);
    expect(near.distanceMeters).toBeGreaterThan(50);
    const far = evaluateGeofence({ latitude: SEDE.latitude + 0.005, longitude: SEDE.longitude }, fence); // ~555 m
    expect(far.outsideGeofence).toBe(true);
    expect(far.radiusMeters).toBe(100);
  });

  it('valida coordenadas y radio de la geocerca (10..5000 enteros)', () => {
    expect(() => assertValidGeofence({ ...SEDE, radiusMeters: 100 })).not.toThrow();
    expect(() => assertValidGeofence({ latitude: 91, longitude: 0, radiusMeters: 100 })).toThrow(InvalidGeofenceError);
    expect(() => assertValidGeofence({ latitude: 0, longitude: -181, radiusMeters: 100 })).toThrow(InvalidGeofenceError);
    expect(() => assertValidGeofence({ ...SEDE, radiusMeters: 9 })).toThrow(InvalidGeofenceError);
    expect(() => assertValidGeofence({ ...SEDE, radiusMeters: 5001 })).toThrow(InvalidGeofenceError);
    expect(() => assertValidGeofence({ ...SEDE, radiusMeters: 50.5 })).toThrow(InvalidGeofenceError);
    expect(() => assertValidGeofence({ latitude: 'x', longitude: 0, radiusMeters: 50 })).toThrow(InvalidGeofenceError);
  });
});

describe('ubicacion obligatoria en la marca propia', () => {
  it('exige latitude, longitude y accuracy', () => {
    expect(() => assertSelfLocation(null)).toThrow(AttendanceLocationRequiredError);
    expect(() => assertSelfLocation({ latitude: 1, longitude: 1 })).toThrow(AttendanceLocationRequiredError);
    expect(() => assertSelfLocation({ latitude: 1, accuracy: 5 })).toThrow(AttendanceLocationRequiredError);
  });
  it('rechaza valores fuera de rango y acepta validos', () => {
    expect(() => assertSelfLocation({ latitude: 91, longitude: 0, accuracy: 5 })).toThrow(InvalidAttendanceRecordError);
    expect(() => assertSelfLocation({ latitude: 0, longitude: 181, accuracy: 5 })).toThrow(InvalidAttendanceRecordError);
    expect(() => assertSelfLocation({ latitude: 0, longitude: 0, accuracy: -1 })).toThrow(InvalidAttendanceRecordError);
    expect(assertSelfLocation({ latitude: -12, longitude: -77, accuracy: 8 })).toEqual({
      latitude: -12,
      longitude: -77,
      accuracy: 8,
    });
  });
});

describe('capturedAt (marcas offline)', () => {
  const now = new Date('2026-10-22T15:00:00Z');
  it('acepta hasta 24 h de antiguedad y una tolerancia de 5 min hacia el futuro', () => {
    expect(() => assertCapturedAtAcceptable(new Date(now.getTime() - ATTENDANCE_MAX_CAPTURE_AGE_MS), now)).not.toThrow();
    expect(() => assertCapturedAtAcceptable(new Date(now.getTime() + 4 * 60_000), now)).not.toThrow();
  });
  it('rechaza mas de 24 h, futuro y fecha invalida', () => {
    expect(() => assertCapturedAtAcceptable(new Date(now.getTime() - ATTENDANCE_MAX_CAPTURE_AGE_MS - 1), now)).toThrow(
      AttendanceCaptureTooOldError,
    );
    expect(() => assertCapturedAtAcceptable(new Date(now.getTime() + 6 * 60_000), now)).toThrow(InvalidAttendanceRecordError);
    expect(() => assertCapturedAtAcceptable(new Date('x'), now)).toThrow(InvalidAttendanceRecordError);
  });
});

describe('motivo del registro a nombre de otro', () => {
  it('obligatorio (3..500) en PRESENTE/TARDANZA', () => {
    expect(() => resolveOnBehalfReason('PRESENTE', undefined)).toThrow(AttendanceReasonRequiredError);
    expect(() => resolveOnBehalfReason('TARDANZA', '  ')).toThrow(AttendanceReasonRequiredError);
    expect(() => resolveOnBehalfReason('PRESENTE', 'ab')).toThrow(AttendanceReasonRequiredError);
    expect(() => resolveOnBehalfReason('PRESENTE', 'x'.repeat(501))).toThrow(AttendanceReasonRequiredError);
    expect(resolveOnBehalfReason('PRESENTE', '  Sin celular hoy ')).toBe('Sin celular hoy');
  });
  it('en faltas y permisos es opcional', () => {
    expect(resolveOnBehalfReason('FALTA_INJUSTIFICADA', undefined)).toBeNull();
    expect(resolveOnBehalfReason('FALTA_JUSTIFICADA', 'Aviso previo')).toBe('Aviso previo');
  });
});
