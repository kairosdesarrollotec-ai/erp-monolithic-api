import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { $Enums } from '@prisma/client';
import * as yaml from 'js-yaml';
import { IncidentsController } from './incidents.controller';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AddIncidentActionDto } from './dto/add-incident-action.dto';
import { CloseIncidentDto } from './dto/close-incident.dto';
import { ReferLegalDto } from './dto/refer-legal.dto';
import { IncidentScopeQueryDto } from './dto/incident-scope-query.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { toIncidentDetailResponse, toIncidentResponse } from './incident.mapper';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import {
  INCIDENT_ACTION_KINDS,
  INCIDENT_LIST_DEFAULT_LIMIT,
  INCIDENT_LIST_MAX_LIMIT,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TEXT_MAX_LENGTH,
  INCIDENT_TYPES,
} from '../../domain/incident-catalog';
import {
  IncidentDirectResolveNotAllowedError,
  IncidentNotFoundError,
  IncidentNotOpenError,
  IncidentVersionConflictError,
} from '../../domain/incident-errors';
import { buildAction, buildIncident } from '../../testing/incident-test-fixtures';

/**
 * Verifica que packages/contracts/openapi/incidents.yaml y el backend no diverjan: rutas/metodos, codigos de exito,
 * idempotencia, If-Match, campos obligatorios, enums (vs. schema.prisma y dominio), limites de paginacion, codigos de
 * error y forma de las respuestas.
 */
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/incidents.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

type Operation = { operationId: string; parameters?: any[]; responses: Record<string, any>; requestBody?: any };

function resolveRef(ref: string): any {
  return ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node: any, key: string) => node[key], spec);
}

function deref(node: any): any {
  return node && node.$ref ? resolveRef(node.$ref) : node;
}

function flatten(schema: any): { required: string[]; properties: Record<string, any> } {
  const s = deref(schema);
  if (s.allOf) {
    return s.allOf.map(flatten).reduce(
      (acc: any, part: any) => ({
        required: [...acc.required, ...part.required],
        properties: { ...acc.properties, ...part.properties },
      }),
      { required: [], properties: {} },
    );
  }
  return { required: s.required ?? [], properties: s.properties ?? {} };
}

function dtoFields(dto: new () => unknown): { all: string[]; required: string[] } {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', true, false);
  const all = [...new Set(metas.map((m) => m.propertyName))].sort();
  const optional = new Set(metas.filter((m) => m.type === 'conditionalValidation').map((m) => m.propertyName));
  return { all, required: all.filter((p) => !optional.has(p)).sort() };
}

const HTTP: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post' };

function controllerRoutes() {
  const proto = IncidentsController.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const openApiPath = ('/incidents' + (sub === '/' ? '' : `/${sub}`)).replace(/:id/g, '{id}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

const queryNames = (op: Operation) =>
  (op.parameters ?? [])
    .map(deref)
    .filter((p: any) => p.in === 'query')
    .map((p: any) => p.name)
    .sort();

describe('Contrato OpenAPI incidents.yaml vs backend', () => {
  const routes = controllerRoutes();

  it('cada ruta del controller existe en OpenAPI y viceversa (7 operaciones)', () => {
    const fromController = routes.map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths)
      .flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();
    expect(fromController).toEqual(fromSpec);
    expect(fromSpec).toHaveLength(7);
  });

  it('el codigo de exito declarado en OpenAPI es el que devuelve NestJS', () => {
    for (const route of routes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const success = Object.keys(op.responses).filter((c) => c.startsWith('2'));
      expect({ op: op.operationId, success }).toEqual({ op: op.operationId, success: [String(route.httpCode)] });
    }
  });

  it('todo POST aplica IdempotencyInterceptor y declara el header Idempotency-Key', () => {
    for (const route of routes.filter((r) => r.method === 'post')) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const params = (op.parameters ?? []).map(deref).map((p: any) => p.name);
      expect({ op: op.operationId, interceptor: route.idempotent, header: params.includes('Idempotency-Key') }).toEqual({
        op: op.operationId,
        interceptor: true,
        header: true,
      });
    }
  });

  it('todo comando sobre una incidencia declara If-Match obligatorio y 428 + 409', () => {
    const commands = routes.filter((r) => r.method === 'post' && r.openApiPath.includes('/commands/'));
    expect(commands).toHaveLength(4);
    for (const route of commands) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const headers = (op.parameters ?? []).map(deref).filter((p: any) => p.in === 'header');
      expect({
        op: op.operationId,
        ifMatchRequired: headers.some((p: any) => p.name === 'If-Match' && p.required === true),
        has428: '428' in op.responses,
        has409: '409' in op.responses,
      }).toEqual({ op: op.operationId, ifMatchRequired: true, has428: true, has409: true });
    }
  });

  it.each([
    ['CreateIncidentRequest', CreateIncidentDto],
    ['AddIncidentActionRequest', AddIncidentActionDto],
    ['CloseIncidentRequest', CloseIncidentDto],
    ['ReferLegalRequest', ReferLegalDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('resolve y close comparten CloseIncidentRequest y el limite de texto (2000) coincide', () => {
    expect(spec.paths['/incidents/{id}/commands/resolve'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/CloseIncidentRequest');
    expect(spec.paths['/incidents/{id}/commands/close'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/CloseIncidentRequest');
    for (const [schema, field] of [
      ['CreateIncidentRequest', 'description'],
      ['CreateIncidentRequest', 'suggestion'],
      ['AddIncidentActionRequest', 'description'],
      ['CloseIncidentRequest', 'resolutionSummary'],
      ['ReferLegalRequest', 'reason'],
    ]) {
      expect(spec.components.schemas[schema].properties[field].maxLength).toBe(INCIDENT_TEXT_MAX_LENGTH);
    }
  });

  it('parametros de query de bandeja y detalle coinciden con sus DTO; limit/default coinciden con el runtime', () => {
    expect(queryNames(spec.paths['/incidents'].get)).toEqual(dtoFields(ListIncidentsQueryDto).all);
    expect(queryNames(spec.paths['/incidents/{id}'].get)).toEqual(dtoFields(IncidentScopeQueryDto).all);
    const limit = spec.paths['/incidents'].get.parameters.find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limit.maximum, default: limit.default }).toEqual({ maximum: INCIDENT_LIST_MAX_LIMIT, default: INCIDENT_LIST_DEFAULT_LIMIT });
  });

  it('el detalle expone el header ETag', () => {
    expect(spec.paths['/incidents/{id}'].get.responses['200'].headers).toHaveProperty('ETag');
  });

  it.each([
    ['IncidentType', $Enums.IncidentType, INCIDENT_TYPES],
    ['IncidentSeverity', $Enums.IncidentSeverity, INCIDENT_SEVERITIES],
    ['IncidentStatus', $Enums.IncidentStatus, INCIDENT_STATUSES],
  ])('enum %s coincide con schema.prisma y con las constantes del dominio', (name, prismaEnum, domainValues) => {
    const specValues = [...spec.components.schemas[name].enum].sort();
    expect(specValues).toEqual(Object.values(prismaEnum).sort());
    expect(specValues).toEqual([...domainValues].sort());
  });

  it('enum de kind del historial coincide con schema.prisma y el dominio', () => {
    const specValues = [...spec.components.schemas.IncidentActionEntry.properties.kind.enum].sort();
    expect(specValues).toEqual(Object.values($Enums.IncidentActionKind).sort());
    expect(specValues).toEqual([...INCIDENT_ACTION_KINDS].sort());
  });

  function expectMapperMatchesSchema(schemaName: string, mapperOutput: object) {
    const mapperKeys = Object.keys(mapperOutput).sort();
    const contract = flatten(spec.components.schemas[schemaName]);
    const specProperties = Object.keys(contract.properties).sort();
    expect({ schema: schemaName, missingRequired: contract.required.filter((k) => !mapperKeys.includes(k)) }).toEqual({ schema: schemaName, missingRequired: [] });
    expect({ schema: schemaName, extra: mapperKeys.filter((k) => !specProperties.includes(k)) }).toEqual({ schema: schemaName, extra: [] });
  }

  it('IncidentResponse / IncidentDetailResponse / IncidentActionEntry: claves exactas del contrato', () => {
    const record = buildIncident({ returnId: 'ret-1', actions: [buildAction(), buildAction({ id: 'act-2', kind: 'ACTION' })] });
    const summary = toIncidentResponse(record);
    const detail = toIncidentDetailResponse(record);
    expectMapperMatchesSchema('IncidentResponse', summary);
    expectMapperMatchesSchema('IncidentDetailResponse', detail);
    expectMapperMatchesSchema('IncidentActionEntry', detail.actions[0]);
    expect(summary).not.toHaveProperty('actions');
    expect(detail.actions.map((a) => a.id)).toEqual(['act-1', 'act-2']);
    expect(summary.companyId).toBe(record.operatingCompanyId);
    expect(summary).not.toHaveProperty('organizationId');
  });

  it('codigos de error del runtime coinciden con los documentados (409 VERSION_CONFLICT / INCIDENT_NOT_OPEN, 422, 404)', () => {
    expect([new IncidentVersionConflictError().httpStatus, new IncidentNotOpenError('CERRADA').httpStatus]).toEqual([409, 409]);
    expect(new IncidentVersionConflictError().code).toBe('VERSION_CONFLICT');
    expect(new IncidentNotOpenError('CERRADA').code).toBe('INCIDENT_NOT_OPEN');
    expect(new IncidentNotFoundError().httpStatus).toBe(404);
    const direct = new IncidentDirectResolveNotAllowedError('GRAVE');
    expect({ code: direct.code, status: direct.httpStatus }).toEqual({ code: 'INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED', status: 422 });

    const text = JSON.stringify(spec.paths);
    for (const code of ['VERSION_CONFLICT', 'INCIDENT_NOT_OPEN', 'INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED']) {
      expect(text).toContain(code);
    }
    expect(spec.paths['/incidents/{id}/commands/resolve'].post.responses).toHaveProperty('422');
  });
});
