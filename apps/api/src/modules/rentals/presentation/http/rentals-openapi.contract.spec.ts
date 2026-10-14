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
import { RentalsEvidenceController } from './rentals-evidence.controller';
import { RentalsExtensionsController } from './rentals-extensions.controller';
import { RentalDocumentsController } from './rental-documents.controller';
import { CreateRentalDto } from './dto/create-rental.dto';
import { CreateRentalFromReservationDto } from './dto/create-rental-from-reservation.dto';
import { ValidateDocumentsDto } from './dto/validate-documents.dto';
import { RegisterAlcoholTestDto } from './dto/register-alcohol-test.dto';
import { CommandScopeDto } from './dto/command-scope.dto';
import { ApproveNotaryExceptionDto } from './dto/approve-notary-exception.dto';
import { FormalizeContractDto } from './dto/formalize-contract.dto';
import { GetContractTemplateQueryDto } from './dto/get-contract-template-query.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { AuthorizeExtensionDto } from './dto/authorize-extension.dto';
import { RejectExtensionDto } from './dto/reject-extension.dto';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RENTAL_LIST_MAX_LIMIT, RENTAL_LIST_DEFAULT_LIMIT } from '../../domain/rental-pagination';
import { toRentalResponse } from './rental.mapper';
import { RentalRecord } from '../../application/ports/rental-repository.port';
import { HOLDER_TYPES } from '../../domain/contract-variant';

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

function controllerRoutes() {
  return [
    ...routesOf(RentalsController, '/rentals'),
    ...routesOf(RentalsEvidenceController, '/rentals'),
    ...routesOf(RentalsExtensionsController, '/rentals'),
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

  it('GET /rentals/{id}/contract-template: los query params del contrato son los del DTO', () => {
    const op: Operation = spec.paths['/rentals/{id}/contract-template'].get;
    const queryParams = (op.parameters ?? [])
      .map(deref)
      .filter((p: any) => p.in === 'query')
      .map((p: any) => p.name)
      .sort();
    expect(queryParams).toEqual(dtoFields(GetContractTemplateQueryDto as new () => unknown).all);
  });

  it('formalize-contract: holderType y withCompanyDriver son opcionales y su enum coincide con el dominio', () => {
    const contract = flatten(spec.components.schemas.FormalizeContractRequest);
    expect(contract.required).not.toContain('holderType');
    expect(contract.required).not.toContain('withCompanyDriver');
    expect([...spec.components.schemas.ContractHolderType.enum].sort()).toEqual([...HOLDER_TYPES].sort());
  });

  it('P0-03: el deposito del mapper (con desglose reserva/diferencia) cumple RentalDepositResponse', () => {
    const record = buildRentalRecord({
      status: 'PENDING_DELIVERY',
      reservationId: 'aaaaaaaa-0000-0000-0000-0000000000aa',
      deposit: {
        id: 'dep-1',
        rentalId: 'aaaaaaaa-0000-0000-0000-000000000001',
        originalAmount: '1000.00',
        currency: 'PEN',
        status: 'HELD',
        reservationCreditAmount: '300.00',
        createdAt: new Date('2026-10-02T00:00:00Z'),
      },
    });
    const deposit = toRentalResponse(record).deposit!;
    const contract = flatten(spec.components.schemas.RentalDepositResponse);
    expect(Object.keys(deposit).sort()).toEqual(Object.keys(contract.properties).sort());
    expect(contract.required.every((k) => k in deposit)).toBe(true);
    expect(deposit.amountCollected).toBe('700.00');
  });

  it('el detalle (credito de reserva + ampliaciones) cumple ReservationCreditResponse y RentalExtensionResponse', () => {
    const record = buildRentalRecord({
      status: 'EXTENSION_PENDING',
      reservationCredit: {
        applicable: true,
        reason: 'APPLIED',
        reservationId: 'aaaaaaaa-0000-0000-0000-0000000000aa',
        amount: '300.00',
        currency: 'PEN',
      },
      extensions: [
        {
          id: 'ext-1',
          rentalId: 'aaaaaaaa-0000-0000-0000-000000000001',
          requestedEndAt: new Date('2026-10-06T09:00:00Z'),
          status: 'PENDING',
          paymentId: null,
          addendumDocumentRef: null,
          requestedAt: new Date('2026-10-05T08:00:00Z'),
          resolvedAt: null,
        },
      ],
    });
    const out = toRentalResponse(record);
    const creditContract = flatten(spec.components.schemas.ReservationCreditResponse);
    expect(Object.keys(out.reservationCredit!).sort()).toEqual(Object.keys(creditContract.properties).sort());
    const extContract = flatten(spec.components.schemas.RentalExtensionResponse);
    expect(Object.keys(out.extensions![0]).sort()).toEqual(Object.keys(extContract.properties).sort());
    const reqContract = flatten(spec.components.schemas.ExtensionRequirements);
    expect(Object.keys(out.extensions![0].requirements).sort()).toEqual(Object.keys(reqContract.properties).sort());
  });
});
