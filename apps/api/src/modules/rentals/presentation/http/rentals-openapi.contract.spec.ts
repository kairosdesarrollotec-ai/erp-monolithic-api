import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { $Enums } from '@prisma/client';
import { RentalsController } from './rentals.controller';
import { ContractTemplatesController } from './contract-templates.controller';
import { RentalDocumentsController } from './rental-documents.controller';
import { CreateRentalDto } from './dto/create-rental.dto';
import { CreateRentalFromReservationDto } from './dto/create-rental-from-reservation.dto';
import { ValidateDocumentsDto } from './dto/validate-documents.dto';
import { RegisterAlcoholTestDto } from './dto/register-alcohol-test.dto';
import { CommandScopeDto } from './dto/command-scope.dto';
import { ApproveNotaryExceptionDto } from './dto/approve-notary-exception.dto';
import { FormalizeContractDto } from './dto/formalize-contract.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { AuthorizeExtensionDto } from './dto/authorize-extension.dto';
import { RejectExtensionDto } from './dto/reject-extension.dto';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RENTAL_LIST_MAX_LIMIT, RENTAL_LIST_DEFAULT_LIMIT } from '../../domain/rental-pagination';
import { toRentalResponse } from './rental.mapper';
import { RentalRecord } from '../../application/ports/rental-repository.port';

import * as yaml from 'js-yaml';

const SPEC_PATH = path.resolve(
  __dirname,
  '../../../../../../../packages/contracts/openapi/rentals.yaml',
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
      const openApiPath = (basePath + (sub === '/' ? '' : `/${sub}`))
        .replace(/:id/g, '{id}')
        .replace(/:reservationId/g, '{reservationId}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

/**
 * Incluye tambien ContractTemplatesController (ruta mas especifica
 * 'rentals/contract-templates') - vive aparte de RentalsController por
 * registrarse como sub-dominio de rentals (ver contract-templates.controller.ts),
 * pero comparte el mismo rentals.yaml (v1.1.0, hallazgo E-05).
 */
function controllerRoutes() {
  return [
    ...routesOf(RentalsController, '/rentals'),
    ...routesOf(ContractTemplatesController, '/rentals/contract-templates'),
    ...routesOf(RentalDocumentsController, '/rentals/:id/documents'),
  ];
}

function buildRentalRecord(overrides: Partial<RentalRecord> = {}): RentalRecord {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    organizationId: 'aaaaaaaa-0000-0000-0000-000000000002',
    operatingCompanyId: 'aaaaaaaa-0000-0000-0000-000000000003',
    branchId: 'aaaaaaaa-0000-0000-0000-000000000004',
    inquiryId: null,
    reservationId: null,
    customerId: 'aaaaaaaa-0000-0000-0000-000000000005',
    customerName: 'Juanita Perez',
    customerDocNumber: '44556677',
    vehicleId: 'aaaaaaaa-0000-0000-0000-000000000006',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'DRAFT',
    startAt: new Date('2026-10-01T09:00:00Z'),
    expectedEndAt: new Date('2026-10-05T09:00:00Z'),
    alcoholTestResult: null,
    createdAt: new Date('2026-09-30T00:00:00Z'),
    createdBy: 'firebase-uid-test',
    updatedAt: new Date('2026-09-30T00:00:00Z'),
    updatedBy: 'firebase-uid-test',
    version: 1,
    ...overrides,
  };
}

describe('Contrato OpenAPI rentals.yaml vs backend', () => {
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
      const headerParams = (op.parameters ?? [])
        .map(deref)
        .filter((p: any) => p.in === 'header')
        .map((p: any) => p.name);
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
    ['CreateRentalRequest', CreateRentalDto],
    ['CreateRentalFromReservationRequest', CreateRentalFromReservationDto],
    ['ValidateDocumentsRequest', ValidateDocumentsDto],
    ['RegisterAlcoholTestRequest', RegisterAlcoholTestDto],
    ['EvaluateNotaryRequest', CommandScopeDto],
    ['ApproveNotaryExceptionRequest', ApproveNotaryExceptionDto],
    ['FormalizeContractRequest', FormalizeContractDto],
    ['CompleteDeliveryRequest', CompleteDeliveryDto],
    ['RequestExtensionRequest', RequestExtensionDto],
    ['AuthorizeExtensionRequest', AuthorizeExtensionDto],
    ['RejectExtensionRequest', RejectExtensionDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('limite maximo de la bandeja coincide con la constante del runtime', () => {
    const limitSchema = spec.paths['/rentals'].get.parameters.find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limitSchema.maximum, default: limitSchema.default }).toEqual({
      maximum: RENTAL_LIST_MAX_LIMIT,
      default: RENTAL_LIST_DEFAULT_LIMIT,
    });
  });

  it.each([
    ['RentalStatus', $Enums.RentalStatus],
    ['AlcoholTestResult', $Enums.AlcoholTestResult],
    ['NotaryResult', $Enums.NotaryResult],
  ])('enum %s coincide con el enum de schema.prisma', (name, prismaEnum) => {
    expect([...spec.components.schemas[name].enum].sort()).toEqual(Object.values(prismaEnum).sort());
  });

  it('RentalResponse: las claves obligatorias del contrato aparecen en el mapper, y el mapper no devuelve claves fuera del contrato', () => {
    const record = buildRentalRecord();
    const mapperOutput = toRentalResponse(record);
    const mapperKeys = Object.keys(mapperOutput).sort();
    const contract = flatten(spec.components.schemas.RentalResponse);
    const specRequired = [...contract.required].sort();
    const specProperties = Object.keys(contract.properties).sort();

    expect(specRequired.every((k) => mapperKeys.includes(k))).toBe(true);
    expect(mapperKeys.every((k) => specProperties.includes(k))).toBe(true);
  });
});
