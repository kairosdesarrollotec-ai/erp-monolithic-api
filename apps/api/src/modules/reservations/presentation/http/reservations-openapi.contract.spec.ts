import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { $Enums } from '@prisma/client';
import { ReservationsController } from './reservations.controller';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { CommandScopeDto } from './dto/command-scope.dto';
import { FlagVehicleSaleDto } from './dto/flag-vehicle-sale.dto';
import { ResolveVehicleSaleDto } from './dto/resolve-vehicle-sale.dto';
import { SALE_DECISIONS } from '../../domain/reservation-sale-resolution';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RESERVATION_LIST_MAX_LIMIT, RESERVATION_LIST_DEFAULT_LIMIT } from '../../domain/reservation-pagination';
import { toReservationResponse } from './reservation.mapper';
import { ReservationRecord } from '../../application/ports/reservation-repository.port';

import * as yaml from 'js-yaml';

/**
 * Verifica que packages/contracts/openapi/reservations.yaml y el backend
 * no diverjan: rutas/metodos, codigos HTTP, control de concurrencia
 * (If-Match/428/412), campos obligatorios de request, enums, limites de
 * paginacion y forma de la respuesta.
 */
const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/reservations.yaml',
);
 
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

type Operation = { operationId: string; deprecated?: boolean; parameters?: any[]; responses: Record<string, unknown>; requestBody?: any };

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
  const proto = ReservationsController.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const openApiPath = ('/reservations' + (sub === '/' ? '' : `/${sub}`)).replace(/:id/g, '{id}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

/** Fixture minimo para el mapper (todos los campos que ReservationRecord requiere). */
function buildReservationRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    organizationId: 'aaaaaaaa-0000-0000-0000-000000000002',
    operatingCompanyId: 'aaaaaaaa-0000-0000-0000-000000000003',
    branchId: 'aaaaaaaa-0000-0000-0000-000000000004',
    inquiryId: 'aaaaaaaa-0000-0000-0000-000000000005',
    customerId: 'aaaaaaaa-0000-0000-0000-000000000006',
    customerName: 'Test Customer',
    vehicleId: 'aaaaaaaa-0000-0000-0000-000000000007',
    vehiclePlate: 'ABC-123',
    vehicleLabel: 'Toyota Corolla 2022',
    status: 'DRAFT',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-10-01T09:00:00Z'),
    endAt: new Date('2026-10-01T11:00:00Z'),
    requiredPaymentAmount: '350.00',
    currency: 'PEN',
    paymentPolicyVersion: 1,
    paymentValidatedAt: null,
    documentsCompletedAt: null,
    confirmedAt: null,
    createdAt: new Date('2026-09-25T00:00:00Z'),
    createdBy: 'firebase-uid-test',
    version: 1,
    ...overrides,
  };
}

describe('Contrato OpenAPI reservations.yaml vs backend', () => {
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

  it('todo comando POST (/commands/) declara If-Match obligatorio y respuestas 428 + 412', () => {
    const commandRoutes = routes.filter((r) => r.method === 'post' && r.openApiPath.includes('/commands/'));
    for (const route of commandRoutes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const headerParams = (op.parameters ?? []).map(deref).filter((p: any) => p.in === 'header').map((p: any) => p.name);
      expect({
        op: op.operationId,
        hasIfMatch: headerParams.includes('If-Match'),
        has428: '428' in op.responses,
        has412: '412' in op.responses,
      }).toEqual({
        op: op.operationId,
        hasIfMatch: true,
        has428: true,
        has412: true,
      });
    }
  });

  it.each([
    ['CreateReservationRequest', CreateReservationDto],
    ['CancelReservationRequest', CancelReservationDto],
    ['CommandScopeRequest', CommandScopeDto],
    ['FlagVehicleSaleRequest', FlagVehicleSaleDto],
    ['ResolveVehicleSaleRequest', ResolveVehicleSaleDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('ResolveVehicleSaleRequest.decision coincide con SALE_DECISIONS del dominio', () => {
    const contract = flatten(spec.components.schemas.ResolveVehicleSaleRequest);
    expect([...contract.properties.decision.enum].sort()).toEqual([...SALE_DECISIONS].sort());
  });

  it('flag-sale y resolve-sale: comandos con Idempotency-Key opcional, 200 y errores 403/404/409/412/422/428 declarados', () => {
    for (const route of ['/reservations/{id}/commands/flag-sale', '/reservations/{id}/commands/resolve-sale']) {
      const op: Operation = spec.paths[route].post;
      const headers = (op.parameters ?? []).map(deref).filter((p: any) => p.in === 'header').map((p: any) => p.name);
      expect(headers).toEqual(expect.arrayContaining(['If-Match', 'Idempotency-Key']));
      expect(Object.keys(op.responses).sort()).toEqual(['200', '403', '404', '409', '412', '422', '428']);
    }
  });

  it('limite maximo de la bandeja coincide con la constante del runtime', () => {
    const limitSchema = spec.paths['/reservations'].get.parameters.find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limitSchema.maximum, default: limitSchema.default }).toEqual({
      maximum: RESERVATION_LIST_MAX_LIMIT,
      default: RESERVATION_LIST_DEFAULT_LIMIT,
    });
  });

  it.each([
    ['ReservationStatus', $Enums.ReservationStatus],
    ['ChannelMode', $Enums.ChannelMode],
  ])('enum %s coincide con el enum de schema.prisma', (name, prismaEnum) => {
    expect([...spec.components.schemas[name].enum].sort()).toEqual(Object.values(prismaEnum).sort());
  });

  it('ReservationResponse: las claves obligatorias del contrato aparecen en el mapper, y el mapper no devuelve claves fuera del contrato', () => {
    const record = buildReservationRecord();
    const mapperOutput = toReservationResponse(record);
    const mapperKeys = Object.keys(mapperOutput).sort();
    const contract = flatten(spec.components.schemas.ReservationResponse);
    const specRequired = [...contract.required].sort();
    const specProperties = Object.keys(contract.properties).sort();

    expect(specRequired.every((k) => mapperKeys.includes(k))).toBe(true);
    expect(mapperKeys.every((k) => specProperties.includes(k))).toBe(true);
  });
});
