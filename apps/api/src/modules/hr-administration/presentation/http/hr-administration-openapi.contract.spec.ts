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
    expect(spec.info.version).toBe('0.5.0');
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
      '/attendance/summary',
      '/attendance/{id}/reclassify',
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
      '/leaves/{id}/evidence',
      '/leaves/{id}/evidence/upload-url',
      '/leaves/{id}/resolve',
      '/me/employee',
      '/trainings',
      '/vacations/calendar',
    ]);
  });

  it('expone exactamente las 33 operaciones esperadas', () => {
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
        'authorizeFieldTrip',
        'createEmployee',
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
        'listEmployees',
        'listFieldTrips',
        'listLeaveEvidence',
        'linkEmployeeAccount',
        'listTrainings',
        'logAttendance',
        'reclassifyAttendance',
        'recordLeaveEvidence',
        'registerTraining',
        'rejectFieldTrip',
        'requestAttendanceEvidenceUploadUrl',
        'requestFieldTrip',
        'requestLeave',
        'requestLeaveEvidenceUploadUrl',
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
});
