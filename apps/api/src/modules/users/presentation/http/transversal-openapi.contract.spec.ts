import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { UsersController } from './users.controller';
import { AuditController } from '../../../audit/presentation/http/audit.controller';
import { SelectWorkContextDto } from './dto/select-work-context.dto';
import { RecordLoginAttemptDto } from '../../../audit/presentation/http/dto/record-login-attempt.dto';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

/**
 * Verifica que packages/contracts/openapi/transversal.yaml y el backend
 * no diverjan: rutas/metodos, codigos HTTP, campos obligatorios de
 * request y enums (WorkerRole).
 *
 * Nota: /notifications (NotificationsController) no tiene contrato YAML
 * todavia — STOP MISSING_API_CONTRACT pendiente de creacion de
 * notifications.yaml.
 */
const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/transversal.yaml',
);
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));

type Operation = { operationId: string; parameters?: any[]; responses: Record<string, unknown>; requestBody?: any };

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

const HTTP: Record<number, string> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
};

interface RouteInfo { name: string; openApiPath: string; method: string; httpCode: number }

function routesFor(controller: any, basePath: string): RouteInfo[] {
  const proto = controller.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const openApiPath = (`/${basePath}` + (sub === '/' ? '' : `/${sub}`)).replace(/:id/g, '{id}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      return { name, openApiPath, method, httpCode };
    });
}

describe('Contrato OpenAPI transversal.yaml vs backend', () => {
  const routes: RouteInfo[] = [
    ...routesFor(AuditController, 'audit'),
    ...routesFor(UsersController, 'users/me'),
  ];

  it('cada ruta de los controllers existe en OpenAPI y viceversa', () => {
    const fromController = routes.map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths)
      .flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();
    expect(fromController).toEqual(fromSpec);
  });

  it('el codigo de exito declarado en OpenAPI es el que devuelve NestJS', () => {
    for (const route of routes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const success = Object.keys(op.responses).filter((c) => c.startsWith('2'));
      expect({ op: op.operationId, success }).toEqual({
        op: op.operationId,
        success: [String(route.httpCode)],
      });
    }
  });

  it('RecordLoginAttemptRequest: mismos campos y mismos obligatorios que el DTO', () => {
    const contract = flatten(spec.components.schemas.RecordLoginAttemptRequest);
    const fields = dtoFields(RecordLoginAttemptDto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('SelectWorkContextRequest: mismos campos y mismos obligatorios que el DTO', () => {
    const contract = flatten(spec.components.schemas.SelectWorkContextRequest);
    const fields = dtoFields(SelectWorkContextDto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('enum WorkerRole coincide entre transversal.yaml y el dominio', () => {
    expect([...spec.components.schemas.WorkerRole.enum].sort()).toEqual([...WORKER_ROLES].sort());
  });
});
