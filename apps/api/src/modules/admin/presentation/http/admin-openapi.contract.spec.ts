import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { AdminController } from './admin.controller';
import { MePermissionsController } from './me-permissions.controller';
import { AssignUserDto } from './dto/assign-user.dto';
import { UpdateReservationDepositPolicyDto } from './dto/update-reservation-deposit-policy.dto';
import { SaveRolePermissionMatrixDto } from './dto/save-role-permission-matrix.dto';
import { SaveNotificationTemplateDto } from './dto/save-notification-template.dto';
import { DeactivateAssignmentDto } from './dto/deactivate-assignment.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RenameRoleDto } from './dto/rename-role.dto';
import { DeactivateRoleDto } from './dto/deactivate-role.dto';
import { NOTIFICATION_CHANNELS } from '../../../notification-templates/domain/notification-variable-catalog';

import * as yaml from 'js-yaml';

/**
 * Verifica que packages/contracts/openapi/admin.yaml y el backend no
 * diverjan: rutas/metodos, codigos HTTP, campos obligatorios de request
 * y enums (NotificationChannel, PermissionModule). El rol ya no es un enum: es RoleRef.
 */
const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/admin.yaml',
);
 
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

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

const HTTP: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post', [RequestMethod.PATCH]: 'patch' };

function controllerRoutes() {
  return [
    { controller: AdminController, prefix: 'admin' },
    { controller: MePermissionsController, prefix: 'me' },
  ].flatMap(({ controller, prefix }) => {
    const proto = controller.prototype as any;
    return Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
      .map((name) => {
        const handler = proto[name];
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const openApiPath = (`/${prefix}` + (sub === '/' ? '' : `/${sub}`)).replace(/:id/g, '{id}');
        const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
        const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
        return { name, openApiPath, method, httpCode };
      });
  });
}

describe('Contrato OpenAPI admin.yaml vs backend', () => {
  const routes = controllerRoutes();

  it('cada ruta del controller existe en OpenAPI y viceversa', () => {
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

  it.each([
    ['AssignUserRequest', AssignUserDto],
    ['UpdateReservationDepositPolicyRequest', UpdateReservationDepositPolicyDto],
    ['SaveRolePermissionMatrixRequest', SaveRolePermissionMatrixDto],
    ['SaveNotificationTemplateRequest', SaveNotificationTemplateDto],
    ['CreateRoleRequest', CreateRoleDto],
    ['RenameRoleRequest', RenameRoleDto],
  ])('%s: mismos campos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('DeactivateAssignmentDto: mismos campos que el body inline de /admin/assignments/{id}/deactivate', () => {
    const inlineBody = spec.paths['/admin/assignments/{id}/deactivate'].post.requestBody.content['application/json'].schema;
    const fields = dtoFields(DeactivateAssignmentDto as new () => unknown);
    expect(Object.keys(inlineBody.properties).sort()).toEqual(fields.all);
    expect([...inlineBody.required].sort()).toEqual(fields.required);
  });

  it('DeactivateRoleDto: mismos campos que el body inline de /admin/roles/{id}/deactivate', () => {
    const inlineBody = spec.paths['/admin/roles/{id}/deactivate'].post.requestBody.content['application/json'].schema;
    const fields = dtoFields(DeactivateRoleDto as new () => unknown);
    expect(Object.keys(inlineBody.properties).sort()).toEqual(fields.all);
    expect([...inlineBody.required].sort()).toEqual(fields.required);
  });

  it('el rol es un RoleRef {id,name,key} (roles dinamicos): ya no hay enum cerrado WorkerRole', () => {
    expect(spec.components.schemas.WorkerRole).toBeUndefined();
    expect([...spec.components.schemas.RoleRef.required].sort()).toEqual(['id', 'key', 'name']);
  });

  it('enum NotificationChannel coincide entre admin.yaml y el dominio', () => {
    expect([...spec.components.schemas.NotificationChannel.enum].sort()).toEqual([...NOTIFICATION_CHANNELS].sort());
  });

  it('enum PermissionModule coincide entre admin.yaml y el DTO de permisos', () => {
    const specModules = [...spec.components.schemas.PermissionModule.enum].sort();
    // Los valores del DTO se obtienen del @IsIn() - los mismos que el spec debe declarar.
    expect(specModules).toEqual(['ADMIN', 'INCIDENT', 'INQUIRY', 'RENTAL', 'RESERVATION']);
  });
});
