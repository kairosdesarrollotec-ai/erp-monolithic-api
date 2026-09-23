import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { $Enums } from '@prisma/client';
import { InquiriesController } from './inquiries.controller';
import { RegisterInquiryDto } from './dto/register-inquiry.dto';
import { QuoteDto } from './dto/quote.dto';
import { CloseInquiryDto } from './dto/close-inquiry.dto';
import { ConvertToReservationDto } from './dto/convert-to-reservation.dto';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { INQUIRY_LIST_DEFAULT_LIMIT, INQUIRY_LIST_MAX_LIMIT } from '../../domain/inquiry-pagination';
import { toInquiryResponse, toInquirySummaryResponse } from './inquiry.mapper';
import { buildInquiry, buildQuotation } from '../../testing/inquiry-test-fixtures';

// js-yaml llega como dependencia de jest (@istanbuljs/load-nyc-config) - no
// se agrega una dependencia nueva al proyecto solo para este test.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

/**
 * Hallazgo MEDIO de revalidacion PR#7 ("el CI no ejecuta contract tests
 * OpenAPI"): verifica que packages/contracts/openapi/inquiries.yaml y el
 * backend no diverjan - rutas/metodos, codigos de exito, idempotencia,
 * campos obligatorios de los requests, enums, limites de paginacion y
 * forma de las respuestas.
 */
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/inquiries.yaml');
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

/** Aplana allOf -> { required, properties }. */
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
  const proto = InquiriesController.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const openApiPath = ('/inquiries' + (sub === '/' ? '' : `/${sub}`)).replace(/:id/g, '{id}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

describe('Contrato OpenAPI inquiries.yaml vs backend', () => {
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
      expect({ op: op.operationId, success }).toEqual({ op: op.operationId, success: [String(route.httpCode)] });
    }
  });

  it('todo comando (POST) aplica IdempotencyInterceptor y documenta Idempotency-Key + 409', () => {
    for (const route of routes.filter((r) => r.method === 'post')) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const params = (op.parameters ?? []).map(deref).map((p: any) => p.name);
      expect({ op: op.operationId, interceptor: route.idempotent, header: params.includes('Idempotency-Key'), has409: '409' in op.responses }).toEqual({
        op: op.operationId,
        interceptor: true,
        header: true,
        has409: true,
      });
    }
  });

  it.each([
    ['RegisterInquiryRequest', RegisterInquiryDto],
    ['QuoteRequest', QuoteDto],
    ['CloseInquiryRequest', CloseInquiryDto],
    ['ConvertToReservationRequest', ConvertToReservationDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('limit de la bandeja: maximo y default iguales a los que aplica el runtime', () => {
    const limit = spec.paths['/inquiries'].get.parameters.find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limit.maximum, default: limit.default }).toEqual({
      maximum: INQUIRY_LIST_MAX_LIMIT,
      default: INQUIRY_LIST_DEFAULT_LIMIT,
    });
  });

  it.each([
    ['InquiryChannel', $Enums.InquiryChannel],
    ['InquiryStatus', $Enums.InquiryStatus],
    ['InquiryNationality', $Enums.InquiryNationality],
    ['InquiryDataOrigin', $Enums.InquiryDataOrigin],
  ])('enum %s coincide con el enum de schema.prisma', (name, prismaEnum) => {
    expect([...spec.components.schemas[name].enum].sort()).toEqual(Object.values(prismaEnum).sort());
  });

  it('InquirySummaryResponse / InquiryResponse: las claves obligatorias son exactamente las que produce el mapper', () => {
    const record = buildInquiry({ quotations: [buildQuotation()] });
    const summary = flatten(spec.components.schemas.InquirySummaryResponse);
    const detail = flatten(spec.components.schemas.InquiryResponse);

    expect([...summary.required].sort()).toEqual(Object.keys(toInquirySummaryResponse(record)).sort());
    expect([...detail.required].sort()).toEqual(Object.keys(toInquiryResponse(record)).sort());
  });
});
