import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import * as yaml from 'js-yaml';
import { ReportingController } from './reporting.controller';
import { OperationalKpisQueryDto, FinancialKpisQueryDto, ExportQueryDto } from './dto/reporting-query.dto';
import {
  MAX_RANGE_DAYS,
  ReportInvalidDateError,
  ReportInvalidDateRangeError,
  ReportRangeExceedsMaxError,
} from '../../application/queries/reporting.utils';

/**
 * packages/contracts/openapi/reporting.yaml (0.4.0) vs backend: rutas/métodos, filtros
 * dateFrom/dateTo (obligatoriedad y formato), códigos de error 400 y límite de 90 días.
 */
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/reporting.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

function deref(node: any): any {
  return node && node.$ref ? node.$ref.replace(/^#\//, '').split('/').reduce((n: any, k: string) => n[k], spec) : node;
}

function dtoRequired(dto: new () => unknown): Set<string> {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', true, false);
  const all = new Set(metas.map((m) => m.propertyName));
  const optional = new Set(metas.filter((m) => m.type === 'conditionalValidation').map((m) => m.propertyName));
  return new Set([...all].filter((p) => !optional.has(p)));
}

function controllerRoutes(): Record<string, string> {
  const proto = ReportingController.prototype as any;
  const out: Record<string, string> = {};
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor' || !Reflect.hasMetadata(METHOD_METADATA, proto[name])) continue;
    const method = Reflect.getMetadata(METHOD_METADATA, proto[name]) as number;
    const route = Reflect.getMetadata(PATH_METADATA, proto[name]) as string;
    out[`${method === RequestMethod.GET ? 'get' : String(method)} /reporting/${route}`] = name;
  }
  return out;
}

const OPERATIONS: Array<{ path: string; opId: string; dto: new () => unknown; datesRequired: boolean }> = [
  { path: '/reporting/operational', opId: 'getOperationalKpis', dto: OperationalKpisQueryDto, datesRequired: false },
  { path: '/reporting/financial', opId: 'getFinancialKpis', dto: FinancialKpisQueryDto, datesRequired: true },
  { path: '/reporting/export', opId: 'exportReport', dto: ExportQueryDto, datesRequired: true },
];

describe('reporting.yaml vs ReportingController', () => {
  it('declara la versión 0.4.0 e inclusividad de dateFrom/dateTo en Lima', () => {
    expect(spec.info.version).toBe('0.4.0');
    expect(spec.info.description).toContain('INCLUSIVO');
    expect(spec.info.description).toContain('America/Lima');
  });

  it('todas las rutas del controlador existen en el contrato (GET) y viceversa', () => {
    const fromController = Object.keys(controllerRoutes()).sort();
    const fromSpec = Object.entries(spec.paths)
      .flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();
    expect(fromController).toEqual(fromSpec);
  });

  describe.each(OPERATIONS)('$path', ({ path: p, opId, dto, datesRequired }) => {
    const op = spec.paths[p].get;
    const params: any[] = op.parameters;

    it('operationId esperado', () => {
      expect(op.operationId).toBe(opId);
    });

    it.each(['dateFrom', 'dateTo'])('%s: tipo date, obligatoriedad y DTO coinciden', (field) => {
      const param = params.find((x) => x.name === field);
      expect(param).toBeDefined();
      expect(param.in).toBe('query');
      expect(param.schema).toMatchObject({ type: 'string', format: 'date' });
      expect(param.required).toBe(datesRequired);
      expect(dtoRequired(dto).has(field)).toBe(datesRequired);
      expect(param.description).toMatch(/inclusivo/i);
    });

    it('documenta 400 con ReportingError', () => {
      const r400 = op.responses['400'];
      expect(r400).toBeDefined();
      expect(r400.content['application/json'].schema.$ref).toBe('#/components/schemas/ReportingError');
    });
  });

  it('ReportingError: {statusCode, code, detail} y los códigos coinciden con los errores del backend', () => {
    const schema = deref(spec.components.schemas.ReportingError);
    expect(schema.required).toEqual(['statusCode', 'code', 'detail']);
    const backendCodes = [
      new ReportInvalidDateError('x').code,
      new ReportInvalidDateRangeError('x').code,
      new ReportRangeExceedsMaxError('x').code,
    ].sort();
    expect([...schema.properties.code.enum].sort()).toEqual(backendCodes);
    expect(new ReportRangeExceedsMaxError('x').httpStatus).toBe(400);
  });

  it('el contrato menciona el límite de 90 días que aplica el backend', () => {
    expect(MAX_RANGE_DAYS).toBe(90);
    expect(spec.info.description).toContain('90 días');
    expect(spec.info.description).toContain('inclusivos');
  });
});
