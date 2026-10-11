import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { TemplatesController } from './templates.controller';
import { CreateTemplateDto } from './dto/create-template.dto';
import { RequestTemplateUploadUrlDto } from './dto/request-template-upload-url.dto';
import { ActivateTemplateDto } from './dto/activate-template.dto';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { toTemplateResponse } from './template.mapper';
import type { TemplateRecord } from '../../application/ports/template-repository.port';

import * as yaml from 'js-yaml';

const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/templates.yaml',
);

const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

type Operation = {
  operationId: string;
  deprecated?: boolean;
  parameters?: any[];
  responses: Record<string, unknown>;
  requestBody?: any;
};

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
  const optional = new Set(
    metas.filter((m) => m.type === 'conditionalValidation').map((m) => m.propertyName),
  );
  return { all, required: all.filter((p) => !optional.has(p)).sort() };
}

const HTTP: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post' };

function routesOf(controller: new (...args: any[]) => unknown, basePath: string) {
  const proto = controller.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const rawPath = (basePath + (sub === '/' ? '' : `/${sub}`));
      const openApiPath = rawPath.replace(/:id/g, '{id}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

function controllerRoutes() {
  return routesOf(TemplatesController, '/templates');
}

function buildTemplateRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    organizationId: 'aaaaaaaa-0000-0000-0000-000000000002',
    companyId: 'aaaaaaaa-0000-0000-0000-000000000003',
    type: 'RENTAL_CONTRACT',
    name: 'Contrato de alquiler v1',
    version: 1,
    status: 'ACTIVE',
    documentUrl: 'https://storage.googleapis.com/bucket/templates/comp/type/file.pdf',
    documentFormat: 'PDF',
    effectiveFrom: new Date('2026-11-01T00:00:00Z'),
    createdAt: new Date('2026-10-09T10:00:00Z'),
    createdBy: 'firebase-uid-test',
    updatedAt: new Date('2026-10-09T10:05:00Z'),
    updatedBy: 'firebase-uid-test',
    ...overrides,
  };
}

describe('Contrato OpenAPI templates.yaml vs backend', () => {
  const routes = controllerRoutes();

  it('cada ruta del controller existe en OpenAPI y viceversa', () => {
    const fromController = routes.map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths)
      .flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();
    expect(fromController).toEqual(fromSpec);
  });

  it('el codigo de exito declarado en OpenAPI es el que devuelve NestJS (rutas no-deprecated)', () => {
    for (const route of routes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      if (op.deprecated) continue;
      const success = Object.keys(op.responses).filter((c) => c.startsWith('2'));
      expect({ op: op.operationId, success }).toEqual({
        op: op.operationId,
        success: [String(route.httpCode)],
      });
    }
  });

  it('toda ruta POST aplica IdempotencyInterceptor', () => {
    for (const route of routes.filter((r) => r.method === 'post')) {
      expect({ op: route.openApiPath, idempotent: route.idempotent }).toEqual({
        op: route.openApiPath,
        idempotent: true,
      });
    }
  });

  it.each([
    ['CreateTemplateRequest', CreateTemplateDto],
    ['RequestTemplateUploadUrlRequest', RequestTemplateUploadUrlDto],
    ['ActivateTemplateRequest', ActivateTemplateDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('TemplateResponse: las claves obligatorias del contrato aparecen en el mapper, y el mapper no devuelve claves fuera del contrato', () => {
    const record = buildTemplateRecord();
    const mapperOutput = toTemplateResponse(record);
    const mapperKeys = Object.keys(mapperOutput).sort();
    const contract = flatten(spec.components.schemas.TemplateResponse);
    const specRequired = [...contract.required].sort();
    const specProperties = Object.keys(contract.properties).sort();

    expect(specRequired.every((k) => mapperKeys.includes(k))).toBe(true);
    expect(mapperKeys.every((k) => specProperties.includes(k))).toBe(true);
  });
});
