import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { $Enums } from '@prisma/client';
import * as yaml from 'js-yaml';
import { HR_ADMINISTRATION_ACTIONS } from '../../application/policies/hr-administration-role-policy';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';

const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/hr-administration.yaml',
);
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

const enumOf = (name: string): string[] => [...spec.components.schemas[name].enum].sort();
const prismaEnum = (e: Record<string, string>): string[] => Object.values(e).sort();

describe('hr-administration.yaml contract specification', () => {
  it('el archivo de contrato existe y define titulo y version correctos', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
    expect(spec.info.title).toBe('KAIROS ERP - Human Resources Administration API');
    expect(spec.info.version).toBe('0.15.0');
  });

  it('los enums del contrato coinciden exactamente con los generados en Prisma Client', () => {
    expect(enumOf('EmployeeStatus')).toEqual(prismaEnum($Enums.EmployeeStatus));
    expect(enumOf('TerminationReason')).toEqual(prismaEnum($Enums.TerminationReason));
    expect(enumOf('AttendanceStatus')).toEqual(prismaEnum($Enums.AttendanceStatus));
    expect(enumOf('LeaveType')).toEqual(prismaEnum($Enums.LeaveType));
    expect(enumOf('LeaveStatus')).toEqual(prismaEnum($Enums.LeaveStatus));
    expect(enumOf('VacationStatus')).toEqual(prismaEnum($Enums.VacationStatus));
    expect(enumOf('FieldTripStatus')).toEqual(prismaEnum($Enums.FieldTripStatus));
  });

  it('define todas las rutas REST previstas para ADP-01..ADP-10', () => {
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/attendance/apply-deductions',
      '/attendance/pending-review',
      '/attendance/summary',
      '/attendance/{id}/reclassify',
      '/attendance/{id}/review',
      '/branches/{branchId}/geofence',
      '/employees',
      '/employees/{id}',
      '/employees/{id}/attendance',
      '/employees/{id}/attendance/evidence/upload-url',
      '/employees/{id}/field-trips',
      '/employees/{id}/leaves',
      '/employees/{id}/link-account',
      '/employees/{id}/memos',
      '/employees/{id}/terminate',
      '/employees/{id}/trainings',
      '/employees/{id}/vacations',
      '/field-trips',
      '/field-trips/{id}',
      '/field-trips/{id}/advance-timeout',
      '/field-trips/{id}/authorize',
      '/field-trips/{id}/reject',
      '/field-trips/{id}/return',
      '/hr-areas',
      '/hr-areas/{code}/deactivate',
      '/hr-areas/{code}/reactivate',
      '/hr-documents',
      '/hr-documents/active',
      '/hr-documents/{id}/confirm-read',
      '/leaves/{id}/evidence',
      '/leaves/{id}/evidence/upload-url',
      '/leaves/{id}/resolve',
      '/me/attendance',
      '/me/employee',
      '/me/leaves',
      '/me/vacations',
      '/trainings',
      '/vacations/calendar',
      '/vacations/{id}/cancel',
      '/vacations/{id}/reschedule',
      '/vacations/{id}/resolve',
    ]);
  });

  it('expone exactamente las 54 operaciones esperadas', () => {
    const ops: string[] = [];
    for (const item of Object.values<any>(spec.paths)) {
      for (const op of Object.values<any>(item)) {
        if (op && op.operationId) ops.push(op.operationId);
      }
    }
    expect(ops.sort()).toEqual(
      [
        'advanceFieldTripTimeout',
        'applyMonthDeductions',
        'cancelVacation',
        'clearBranchGeofence',
        'confirmHrDocumentRead',
        'getBranchGeofence',
        'getMyAttendance',
        'listAttendancePendingReview',
        'logMyAttendance',
        'reviewAttendance',
        'rescheduleVacation',
        'resolveVacation',
        'setBranchGeofence',
        'authorizeFieldTrip',
        'createEmployee',
        'createHrArea',
        'deactivateHrArea',
        'evaluateFieldTripReturn',
        'getAttendanceSummary',
        'getEmployee',
        'getEmployeeAttendance',
        'getEmployeeLeaves',
        'getEmployeeMemos',
        'getEmployeeTrainings',
        'getEmployeeVacations',
        'getFieldTrip',
        'getMyEmployee',
        'getVacationsCalendar',
        'listActiveHrDocuments',
        'listEmployees',
        'listFieldTrips',
        'listHrAreas',
        'listLeaveEvidence',
        'listMyLeaves',
        'listMyVacations',
        'linkEmployeeAccount',
        'listTrainings',
        'logAttendance',
        'publishHrDocument',
        'reactivateHrArea',
        'reclassifyAttendance',
        'recordLeaveEvidence',
        'registerTraining',
        'rejectFieldTrip',
        'requestAttendanceEvidenceUploadUrl',
        'requestFieldTrip',
        'requestLeave',
        'requestLeaveEvidenceUploadUrl',
        'requestMyLeave',
        'requestMyVacation',
        'resolveLeave',
        'scheduleVacation',
        'terminateEmployment',
        'updateEmployee',
      ].sort(),
    );
  });

  it('las consultas de listado, resumen y calendario exigen companyId y branchId', () => {
    const queries: Array<[string, string]> = [
      ['/employees', 'get'],
      ['/attendance/summary', 'get'],
      ['/vacations/calendar', 'get'],
      ['/field-trips', 'get'],
      ['/hr-areas', 'get'],
    ];
    for (const [route, method] of queries) {
      const params: any[] = spec.paths[route][method].parameters;
      for (const name of ['companyId', 'branchId']) {
        const p = params.find((x) => x.name === name && x.in === 'query');
        expect(p?.required).toBe(true);
      }
    }
    expect(spec.components.schemas.ApplyDeductionsRequest.required).toEqual(
      expect.arrayContaining(['companyId', 'branchId', 'month']),
    );
  });

  it('la cascada de salidas a campo tiene exactamente 3 niveles y no existe 4to nivel (BR-ADP-004)', () => {
    const level = spec.components.schemas.AuthorizeFieldTripRequest.properties.authorizationLevel;
    expect(level.minimum).toBe(1);
    expect(level.maximum).toBe(3);
    expect(spec.components.schemas.FieldTripResponse.properties.authorizationLevel.maximum).toBe(3);
    expect(enumOf('FieldTripStatus')).toContain('NO_AUTORIZADA');
  });

  it('la cascada no nombra personas: los textos son genericos (Nivel 1 de 3, 2 de 3, 3 de 3)', () => {
    const raw = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(raw).not.toMatch(/Fiorella|Jos[eé]\b|Cecilia/);
  });

  it('minutesLate y deductionAmount de LogAttendanceRequest no tienen default 0', () => {
    const props = spec.components.schemas.LogAttendanceRequest.properties;
    expect(props.minutesLate.default).toBeUndefined();
    expect(props.deductionAmount.default).toBeUndefined();
  });

  it('rechazar una salida exige un motivo y /me/employee exige companyId y branchId', () => {
    expect(spec.components.schemas.RejectFieldTripRequest.required).toEqual(['reason']);
    const params: any[] = spec.paths['/me/employee'].get.parameters;
    for (const name of ['companyId', 'branchId']) {
      expect(params.find((x) => x.name === name && x.in === 'query')?.required).toBe(true);
    }
  });

  it('la desvinculacion se registra por una operacion propia y la edicion no la expone (BR-ADP-006)', () => {
    expect(spec.paths['/employees/{id}/terminate'].post.operationId).toBe('terminateEmployment');
    const patchBody = spec.components.schemas.UpdateEmployeeRequest;
    expect(JSON.stringify(patchBody)).not.toContain('TERMINADO');
  });

  it('los errores usan el cuerpo real { statusCode, code, detail }', () => {
    const problem = spec.components.schemas.ProblemDetail;
    expect(problem.required).toEqual(['statusCode', 'code', 'detail']);
  });

  it('HR_ADMINISTRATION esta en el catalogo de permisos y coincide con las acciones del modulo', () => {
    const catalogActions = PERMISSION_ACTION_CATALOG.filter((d) => d.module === 'HR_ADMINISTRATION')
      .map((d) => d.action)
      .sort();
    expect(catalogActions).toEqual([...HR_ADMINISTRATION_ACTIONS].sort());
  });

  it('0.6.0: PATCH /employees/{id} declara If-Match opcional, 412 y el aviso accountRelink (DEC-ADP-EDIT-ETAG-001)', () => {
    const patch = spec.paths['/employees/{id}'].patch;
    const ifMatch = patch.parameters.find((x: any) => x.name === 'If-Match' && x.in === 'header');
    expect(ifMatch?.required).toBe(false);
    expect(Object.keys(patch.responses)).toEqual(expect.arrayContaining(['400', '403', '404', '409', '412', '422']));
    expect(patch.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/UpdateEmployeeResponse');
    expect(patch.responses['200'].headers.ETag).toBeDefined();
    expect(spec.paths['/employees/{id}'].get.responses['200'].headers.ETag).toBeDefined();
    expect(spec.components.schemas.EmployeeResponse.properties.version.type).toBe('integer');
    expect(spec.components.schemas.AccountRelinkNotice.properties.action.enum).toEqual(['RELINKED', 'UNLINKED']);
  });

  it('el controlador implementa lo que el contrato declara en PATCH /employees/{id} (If-Match, ETag, accountRelink, errores)', () => {
    const controller = fs.readFileSync(path.resolve(__dirname, 'employees.controller.ts'), 'utf8');
    expect(controller).toMatch(/@Headers\('if-match'\)/);
    expect(controller).toContain('parseVersionIfMatch');
    expect(controller).toMatch(/setHeader\('ETag'/);
    expect(controller).toContain('accountRelink');
    const errors = fs.readFileSync(path.resolve(__dirname, '../../domain/hr-administration-errors.ts'), 'utf8');
    for (const code of ['EMPLOYEE_VERSION_CONFLICT', 'EMPLOYEE_ACCOUNT_ALREADY_LINKED']) {
      expect(errors).toContain(`'${code}'`);
      expect(fs.readFileSync(SPEC_PATH, 'utf8')).toContain(code);
    }
  });

  it('0.7.0: catalogo de areas (H-02) - GET /hr-areas y areaCode aditivo en alta, edicion, listado y calendario', () => {
    const get = spec.paths['/hr-areas'].get;
    expect(get.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/HrAreaList');
    expect(Object.keys(get.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '403']));
    expect(spec.components.schemas.HrArea.required).toEqual(['code', 'name', 'description', 'sortOrder', 'isActive']);
    const create = spec.components.schemas.CreateEmployeeRequest;
    expect(create.properties.areaCode).toBeDefined();
    // Compatibilidad: areaId/areaName ya no son obligatorios por separado; se pide areaCode o areaName.
    expect(create.required).not.toContain('areaId');
    expect(create.required).not.toContain('areaName');
    expect(create.properties.areaName).toBeDefined();
    expect(spec.paths['/hr-areas'].get.responses['403'].description).toContain('SCHEDULE_VACATION');
    expect(spec.components.schemas.UpdateEmployeeRequest.properties.areaCode).toBeDefined();
    for (const [route, method] of [['/employees', 'get'], ['/vacations/calendar', 'get']] as const) {
      const p = spec.paths[route][method].parameters.find((x: any) => x.name === 'areaCode' && x.in === 'query');
      expect(p?.required).toBe(false);
    }
    const raw = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const code of ['HR_AREA_NOT_FOUND', 'AREA_REQUIRED']) expect(raw).toContain(code);
    const errors = fs.readFileSync(path.resolve(__dirname, '../../domain/hr-administration-errors.ts'), 'utf8');
    for (const code of ['HR_AREA_NOT_FOUND', 'AREA_REQUIRED']) expect(errors).toContain(`'${code}'`);
  });
});

describe('hr-administration.yaml 0.8.0 (Respuestas de negocio 2026-10-20, frente B)', () => {
  it('areas: alta y (des)activacion solo Gerencia, con 409 y 403', () => {
    expect(spec.paths['/hr-areas'].post.operationId).toBe('createHrArea');
    expect(Object.keys(spec.paths['/hr-areas'].post.responses)).toEqual(expect.arrayContaining(['201', '403', '409', '422']));
    expect(Object.keys(spec.paths['/hr-areas/{code}/deactivate'].post.responses)).toEqual(expect.arrayContaining(['200', '403', '409', '422']));
    expect(spec.paths['/hr-areas/{code}/reactivate'].post.operationId).toBe('reactivateHrArea');
    expect(spec.components.schemas.HrArea.required).toContain('isActive');
    const inactive = spec.paths['/hr-areas'].get.parameters.find((p: any) => p.name === 'includeInactive');
    expect(inactive?.required).toBe(false);
  });

  it('los codigos de error nuevos existen en el contrato Y en el dominio', () => {
    const raw = fs.readFileSync(SPEC_PATH, 'utf8');
    const errors = fs.readFileSync(path.resolve(__dirname, '../../domain/hr-administration-errors.ts'), 'utf8');
    for (const code of ['HR_AREA_ALREADY_EXISTS', 'HR_AREA_IN_USE', 'HR_AREA_NAME_INVALID', 'EMPLOYEE_SALARY_GERENCIA_ONLY']) {
      expect(raw).toContain(code);
      expect(errors).toContain(`'${code}'`);
    }
  });

  it('acciones nuevas MANAGE_AREAS y MANAGE_SALARY existen en el catalogo de permisos', () => {
    const actions = PERMISSION_ACTION_CATALOG.filter((d) => d.module === 'HR_ADMINISTRATION').map((d) => d.action);
    expect(actions).toEqual(expect.arrayContaining(['MANAGE_AREAS', 'MANAGE_SALARY']));
  });

  it('ficha: areaCode en la respuesta y 403 por sueldo documentado en PATCH', () => {
    expect(spec.components.schemas.EmployeeResponse.properties.areaCode).toBeDefined();
    expect(spec.components.schemas.EmployeeResponse.required).toContain('areaCode');
    expect(spec.paths['/employees/{id}'].patch.responses['403'].description).toContain('EMPLOYEE_SALARY_GERENCIA_ONLY');
    expect(spec.components.schemas.UpdateEmployeeRequest.properties.baseSalary.description).toContain('Gerencia');
  });

  it('HU-29: latitude/longitude/accuracy opcionales y acotados en el request y presentes en la respuesta', () => {
    const req = spec.components.schemas.LogAttendanceRequest;
    expect(req.required).toEqual(['date', 'status']);
    expect(req.properties.latitude).toMatchObject({ minimum: -90, maximum: 90 });
    expect(req.properties.longitude).toMatchObject({ minimum: -180, maximum: 180 });
    expect(req.properties.accuracy.minimum).toBe(0);
    const res = spec.components.schemas.AttendanceRecordResponse.properties;
    expect(res.latitude.nullable).toBe(true);
    expect(res.longitude.nullable).toBe(true);
    expect(res.accuracy.nullable).toBe(true);
  });

  it('22-oct: la marca propia exige ubicacion y trae los campos de geocerca/revision (#9)', () => {
    const req = spec.components.schemas.LogMyAttendanceRequest;
    expect(req.required).toEqual(
      expect.arrayContaining(['companyId', 'branchId', 'capturedAt', 'latitude', 'longitude', 'accuracy']),
    );
    const rec = spec.components.schemas.AttendanceRecordResponse.properties;
    for (const f of ['source', 'outsideGeofence', 'reviewStatus', 'requiresReview', 'checkOut', 'onBehalfReason']) {
      expect(rec[f]).toBeDefined();
    }
    expect(spec.components.schemas.LogAttendanceRequest.properties.reason).toBeDefined();
    expect(spec.components.schemas.AttendanceEvidenceRequest.properties.kind.enum).toContain('SELF_PHOTO');
    expect(spec.components.schemas.SetBranchGeofenceRequest.properties.radiusMeters).toMatchObject({
      minimum: 10,
      maximum: 5000,
    });
  });

  it('22-oct: reprogramar y cancelar vacaciones (#10) y enmascaramiento HU-35', () => {
    expect(spec.components.schemas.RescheduleVacationRequest.required).toEqual(
      expect.arrayContaining(['startDate', 'endDate', 'reason']),
    );
    expect(spec.components.schemas.CancelVacationRequest.required).toEqual(['reason']);
    for (const f of ['originalStartDate', 'rescheduleCount', 'statusReason']) {
      expect(spec.components.schemas.VacationRequestResponse.properties[f]).toBeDefined();
    }
    const emp = spec.components.schemas.EmployeeResponse;
    expect(emp.properties.documentNumber.nullable).toBe(true);
    expect(emp.required).toContain('restrictedFields');
  });
});

describe('hr-administration.yaml 0.13.0 (Frente R4: autoservicio y resolución de vacaciones)', () => {
  it('declara /me/leaves, /me/vacations y /vacations/{id}/resolve con grantedDays', () => {
    expect(spec.paths['/me/leaves'].get.operationId).toBe('listMyLeaves');
    expect(spec.paths['/me/leaves'].post.operationId).toBe('requestMyLeave');
    expect(spec.paths['/me/vacations'].get.operationId).toBe('listMyVacations');
    expect(spec.paths['/me/vacations'].post.operationId).toBe('requestMyVacation');
    expect(spec.paths['/vacations/{id}/resolve'].patch.operationId).toBe('resolveVacation');
    expect(spec.components.schemas.ResolveVacationRequest.properties.grantedDays).toBeDefined();
    expect(spec.components.schemas.VacationRequestResponse.properties.grantedDays).toBeDefined();
  });
});
