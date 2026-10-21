import 'reflect-metadata';
import { computeReturnLatenessCharge } from '../../domain/return-lateness';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { $Enums } from '@prisma/client';
import * as yaml from 'js-yaml';
import { ReturnsController } from './returns.controller';
import { ReturnEvidenceController } from './return-evidence.controller';
import { ScheduleReturnDto } from './dto/schedule-return.dto';
import { ReceiveProvisionalDto } from './dto/receive-provisional.dto';
import { RegisterReturnAlcoholTestDto } from './dto/register-return-alcohol-test.dto';
import { CompleteInspectionDto, ResponsibilityDocumentDto } from './dto/complete-inspection.dto';
import { ResolveAlcoholEscalationDto } from './dto/resolve-alcohol-escalation.dto';
import { AssessDamageDto } from './dto/assess-damage.dto';
import { ChargeImmobilizationDto } from './dto/charge-immobilization.dto';
import { CloseFinancialDto } from './dto/close-financial.dto';
import { CloseReturnDto } from './dto/close-return.dto';
import {
  RequestReturnEvidenceUploadSessionDto,
  RETURN_EVIDENCE_CONTENT_TYPES,
} from './dto/request-return-evidence-upload-session.dto';
import { RecordReturnEvidenceDto } from './dto/record-return-evidence.dto';
import { RegisterReturnReminderDto } from './dto/register-return-reminder.dto';
import { ListReturnRemindersQueryDto } from './dto/list-return-reminders-query.dto';
import { ListReturnAlertsQueryDto } from './dto/list-return-alerts-query.dto';
import { ListReturnsQueryDto } from './dto/list-returns-query.dto';
import { ReturnScopeQueryDto } from './dto/return-scope-query.dto';
import {
  toCosmeticTariffResponse,
  toImmobilizationChargeResponse,
  toReturnDamageResponse,
  toReturnEvidenceResponse,
  toReturnResponse,
  toReminderInboxItemResponse,
  toReturnAlertItemResponse,
  toReturnReminderResponse,
} from './return.mapper';
import { RETURN_REMINDER_STATUSES } from '../../domain/return-reminder';
import { RETURN_ALERT_TYPES } from '../../application/queries/list-return-alerts.query';
import {
  RETURN_ALERT_LIST_DEFAULT_LIMIT,
  RETURN_ALERT_LIST_MAX_LIMIT,
} from '../../application/queries/list-return-alerts.query';
import {
  RETURN_REMINDER_LIST_DEFAULT_LIMIT,
  RETURN_REMINDER_LIST_MAX_LIMIT,
} from '../../application/queries/list-return-reminders.query';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RETURN_LIST_DEFAULT_LIMIT, RETURN_LIST_MAX_LIMIT } from '../../domain/return-pagination';
import { MAX_RETURN_EVIDENCE_BYTES } from '../../domain/return-evidence-requirements';
import { COSMETIC_DAMAGE_TARIFF, COSMETIC_ZONE_CODES, listCosmeticTariff } from '../../domain/cosmetic-damage-rate';
import { CUSTOMER_RISK_STATUSES } from '../../domain/customer-risk-status';
import { ActiveIncidentsBlockCloseError } from '../../domain/return-errors';
import {
  ALCOHOL_ESCALATION_DECISIONS,
  ALCOHOL_TEST_RESULTS,
  DAMAGE_ORIGINS,
  DAMAGE_SEVERITIES,
  RETURN_EVIDENCE_TYPES,
  RETURN_FUEL_LEVELS,
  RETURN_STATUSES,
} from '../../domain/return-status';
import {
  buildCharge,
  buildReminder,
  buildReturnRecord,
  FIXED_NOW,
  buildTechnicalDamage,
} from '../../testing/return-test-fixtures';

 
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/returns.yaml');
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
  const optional = new Set(metas.filter((m) => m.type === 'conditionalValidation').map((m) => m.propertyName));
  return { all, required: all.filter((p) => !optional.has(p)).sort() };
}

const HTTP: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post', [RequestMethod.DELETE]: 'delete' };

function routesOf(controller: new (...args: any[]) => unknown, basePath: string) {
  const proto = controller.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[name]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const openApiPath = (basePath + (sub === '/' ? '' : `/${sub}`)).replace(/:(\w+)/g, '{$1}');
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200);
      const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[];
      return { name, openApiPath, method, httpCode, idempotent: interceptors.includes(IdempotencyInterceptor) };
    });
}

function controllerRoutes() {
  return [
    ...routesOf(ReturnsController, '/returns'),
    ...routesOf(ReturnEvidenceController, '/returns/:id/evidence'),
  ];
}

describe('Contrato OpenAPI returns.yaml vs backend', () => {
  const routes = controllerRoutes();

  it('cada ruta del controller existe en OpenAPI y viceversa (21 operaciones)', () => {
    const fromController = routes.map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths)
      .flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();
    expect(fromController).toEqual(fromSpec);
    expect(fromSpec).toHaveLength(21);
  });

  it('el código de exito declarado en OpenAPI es el que devuelve NestJS', () => {
    for (const route of routes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const success = Object.keys(op.responses).filter((c) => c.startsWith('2'));
      expect({ op: op.operationId, success }).toEqual({ op: op.operationId, success: [String(route.httpCode)] });
    }
  });

  it('toda ruta POST aplica IdempotencyInterceptor', () => {
    for (const route of routes.filter((r) => r.method === 'post')) {
      expect({ op: route.openApiPath, idempotent: route.idempotent }).toEqual({ op: route.openApiPath, idempotent: true });
    }
  });

  it('todo comando POST (/commands/) declara If-Match obligatorio y respuestas 428 + 412', () => {
    const commandRoutes = routes.filter((r) => r.method === 'post' && r.openApiPath.includes('/commands/'));
    expect(commandRoutes).toHaveLength(9);
    for (const route of commandRoutes) {
      const op: Operation = spec.paths[route.openApiPath][route.method];
      const headerParams = (op.parameters ?? []).map(deref).filter((p: any) => p.in === 'header');
      expect({
        op: op.operationId,
        ifMatchRequired: headerParams.some((p: any) => p.name === 'If-Match' && p.required === true),
        has428: '428' in op.responses,
        has412: '412' in op.responses,
      }).toEqual({ op: op.operationId, ifMatchRequired: true, has428: true, has412: true });
    }
  });

  it.each([
    ['ScheduleReturnRequest', ScheduleReturnDto],
    ['ReceiveProvisionalRequest', ReceiveProvisionalDto],
    ['RegisterReturnAlcoholTestRequest', RegisterReturnAlcoholTestDto],
    ['ResolveAlcoholEscalationRequest', ResolveAlcoholEscalationDto],
    ['ResponsibilityDocumentRequest', ResponsibilityDocumentDto],
    ['CompleteInspectionRequest', CompleteInspectionDto],
    ['AssessDamageRequest', AssessDamageDto],
    ['RegisterReturnReminderRequest', RegisterReturnReminderDto],
    ['ChargeImmobilizationRequest', ChargeImmobilizationDto],
    ['CloseFinancialRequest', CloseFinancialDto],
    ['CloseReturnRequest', CloseReturnDto],
    ['RequestReturnEvidenceUploadSessionRequest', RequestReturnEvidenceUploadSessionDto],
    ['RecordReturnEvidenceRequest', RecordReturnEvidenceDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schemaName, dto) => {
    const contract = flatten(spec.components.schemas[schemaName]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    // Obligatorio en el contrato pero validado por el dominio con 422 (no 400): ver CompleteInspectionDto.
    const domainEnforcedRequired: Record<string, string[]> = { CompleteInspectionRequest: ['responsibilityDocument'] };
    const expectedRequired = [...fields.required, ...(domainEnforcedRequired[schemaName] ?? [])].sort();
    expect([...contract.required].sort()).toEqual(expectedRequired);
  });

  it('ChargeImmobilizationRequest ya no acepta dailyRate (la tarifa sale del vehículo, TDD §9.3)', () => {
    const contract = flatten(spec.components.schemas.ChargeImmobilizationRequest);
    expect(Object.keys(contract.properties)).not.toContain('dailyRate');
    expect(dtoFields(ChargeImmobilizationDto).all).not.toContain('dailyRate');
  });

  it('AssessDamageRequest: damagedZone es el enum del tarifario y customerAcceptsCost es opcional', () => {
    const contract = flatten(spec.components.schemas.AssessDamageRequest);
    expect([...deref(contract.properties.damagedZone).enum].sort()).toEqual([...COSMETIC_ZONE_CODES].sort());
    expect(contract.required).not.toContain('customerAcceptsCost');
    expect(contract.properties.customerAcceptsCost.type).toBe('boolean');
  });

  it('INCIDENT_STILL_OPEN es 422 en el runtime y en close-financial / close del contrato', () => {
    const error = new ActiveIncidentsBlockCloseError(['DANOS_SIN_EVALUAR']);
    expect({ code: error.code, httpStatus: error.httpStatus }).toEqual({ code: 'INCIDENT_STILL_OPEN', httpStatus: 422 });
    for (const path of ['/returns/{id}/commands/close-financial', '/returns/{id}/commands/close']) {
      const op: Operation = spec.paths[path].post;
      expect(op.responses).toHaveProperty('422');
      expect(JSON.stringify(op.responses['422'])).toContain('INCIDENT_STILL_OPEN');
      expect(JSON.stringify(op.responses['409'])).not.toContain('INCIDENT_STILL_OPEN');
    }
  });

  it('1.7.0: register-alcohol-test documenta 422 ALCOHOL_TEST_PHOTO_REQUIRED y register-late-charge es 200 idempotente con If-Match', () => {
    expect(spec.info.version).toBe('1.7.0');
    const alcohol: Operation = spec.paths['/returns/{id}/commands/register-alcohol-test'].post;
    expect(JSON.stringify(alcohol.responses['422'])).toContain('ALCOHOL_TEST_PHOTO_REQUIRED');
    const op: Operation = spec.paths['/returns/{id}/commands/register-late-charge'].post;
    expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['200', '403', '404', '409', '412', '422', '428']));
    const route = routes.find((r) => r.openApiPath === '/returns/{id}/commands/register-late-charge');
    expect(route).toMatchObject({ method: 'post', httpCode: 200, idempotent: true });
  });

  it('ALCOHOL_TEST_DISAPPROVAL ya no existe en el contrato (el alcolímetro desfavorable responde 200)', () => {
    expect(fs.readFileSync(SPEC_PATH, 'utf8')).not.toContain('ALCOHOL_TEST_DISAPPROVAL');
  });

  it('resolve-alcohol-escalation: 200, Idempotency-Key, 403 y 409 documentados', () => {
    const op: Operation = spec.paths['/returns/{id}/commands/resolve-alcohol-escalation'].post;
    expect(op.operationId).toBe('resolveAlcoholEscalation');
    expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['200', '403', '409', '412', '428']));
    const route = routes.find((r) => r.name === 'resolveAlcoholEscalationCommand');
    expect(route).toMatchObject({ openApiPath: '/returns/{id}/commands/resolve-alcohol-escalation', httpCode: 200, idempotent: true });
  });

  it('getCosmeticTariff: GET con los mismos query params de scope y el controller lo declara antes de :id', () => {
    const op: Operation = spec.paths['/returns/cosmetic-tariff'].get;
    expect(op.operationId).toBe('getCosmeticTariff');
    const queryNames = (op.parameters ?? []).map(deref).filter((p: any) => p.in === 'query').map((p: any) => p.name).sort();
    expect(queryNames).toEqual(dtoFields(ReturnScopeQueryDto).all);
    expect((op.parameters ?? []).map(deref).some((p: any) => p.name === 'If-Match')).toBe(false);
    const names = Object.getOwnPropertyNames(ReturnsController.prototype);
    expect(names.indexOf('cosmeticTariff')).toBeLessThan(names.indexOf('detail'));
  });

  it('parámetros de query de bandeja y detalle coinciden con sus DTO', () => {
    const queryNames = (op: Operation) =>
      (op.parameters ?? [])
        .map(deref)
        .filter((p: any) => p.in === 'query')
        .map((p: any) => p.name)
        .sort();
    expect(queryNames(spec.paths['/returns'].get)).toEqual(dtoFields(ListReturnsQueryDto).all);
    expect(queryNames(spec.paths['/returns/{id}'].get)).toEqual(dtoFields(ReturnScopeQueryDto).all);
    expect(queryNames(spec.paths['/returns/{id}/evidence'].get)).toEqual(dtoFields(ReturnScopeQueryDto).all);
  });

  it('limite máximo/por defecto de la bandeja y límites de evidencia coinciden con el runtime', () => {
    const limitSchema = spec.paths['/returns'].get.parameters.find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limitSchema.maximum, default: limitSchema.default }).toEqual({
      maximum: RETURN_LIST_MAX_LIMIT,
      default: RETURN_LIST_DEFAULT_LIMIT,
    });
    const upload = spec.components.schemas.RequestReturnEvidenceUploadSessionRequest.properties;
    expect(upload.contentLength.maximum).toBe(MAX_RETURN_EVIDENCE_BYTES);
    expect([...upload.contentType.enum].sort()).toEqual([...RETURN_EVIDENCE_CONTENT_TYPES].sort());
  });

  it.each([
    ['ReturnStatus', $Enums.ReturnStatus, RETURN_STATUSES],
    ['CustodyHolder', $Enums.CustodyHolder, ['CLIENTE', 'VELOXRENT', 'TALLER']],
    ['DamageOrigin', $Enums.DamageOrigin, DAMAGE_ORIGINS],
    ['DamageSeverity', $Enums.DamageSeverity, DAMAGE_SEVERITIES],
    ['ReturnFuelLevel', $Enums.ReturnFuelLevel, RETURN_FUEL_LEVELS],
    ['AlcoholTestResult', $Enums.AlcoholTestResult, ALCOHOL_TEST_RESULTS],
    ['ReturnEvidenceType', $Enums.ReturnEvidenceType, RETURN_EVIDENCE_TYPES],
    ['ReturnReminderStatus', $Enums.ReturnReminderStatus, RETURN_REMINDER_STATUSES],
    ['ReturnAlertType', { WARRANTY_RELEASE: 'WARRANTY_RELEASE', IMMOBILIZATION: 'IMMOBILIZATION' }, RETURN_ALERT_TYPES],
  ])('enum %s coincide con schema.prisma y con las constantes del dominio', (name, prismaEnum, domainValues) => {
    const specValues = [...spec.components.schemas[name].enum].sort();
    expect(specValues).toEqual(Object.values(prismaEnum).sort());
    expect(specValues).toEqual([...domainValues].sort());
  });

  it('enum AlcoholEscalationDecision coincide con schema.prisma (parseado del texto) y con el dominio', () => {
    const schemaText = fs.readFileSync(path.resolve(SPEC_PATH, '../../../../apps/api/prisma/schema.prisma'), 'utf8');
    const block = /enum AlcoholEscalationDecision \{([^}]*)\}/.exec(schemaText)?.[1] ?? '';
    const prismaValues = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));
    const specValues = [...spec.components.schemas.AlcoholEscalationDecision.enum].sort();
    expect(specValues).toEqual([...prismaValues].sort());
    expect(specValues).toEqual([...ALCOHOL_ESCALATION_DECISIONS].sort());
  });

  it('CustomerRiskStatus del contrato coincide con el semáforo de dominio (NORMAL|AMBAR|ROJO)', () => {
    expect([...spec.components.schemas.CustomerRiskStatus.enum].sort()).toEqual([...CUSTOMER_RISK_STATUSES].sort());
  });

  it('CosmeticZone del contrato coincide con COSMETIC_DAMAGE_TARIFF', () => {
    expect([...spec.components.schemas.CosmeticZone.enum].sort()).toEqual([...COSMETIC_DAMAGE_TARIFF.keys()].sort());
  });

  function expectMapperMatchesSchema(schemaName: string, mapperOutput: object) {
    const mapperKeys = Object.keys(mapperOutput).sort();
    const contract = flatten(spec.components.schemas[schemaName]);
    const specProperties = Object.keys(contract.properties).sort();
    expect({ schema: schemaName, missingRequired: contract.required.filter((k) => !mapperKeys.includes(k)) }).toEqual({
      schema: schemaName,
      missingRequired: [],
    });
    expect({ schema: schemaName, extra: mapperKeys.filter((k) => !specProperties.includes(k)) }).toEqual({
      schema: schemaName,
      extra: [],
    });
  }

  it('ReturnResponse: claves obligatorias en el mapper y ninguna clave fuera del contrato (incluye subentidades)', () => {
    const record = buildReturnRecord({
      damages: [buildTechnicalDamage()],
      immobilizationCharges: [buildCharge()],
    });
    const response = toReturnResponse(record);
    expectMapperMatchesSchema('ReturnResponse', response);
    expectMapperMatchesSchema('ReturnDamageResponse', response.damages[0]);
    expectMapperMatchesSchema('ImmobilizationChargeResponse', response.immobilizationCharges[0]);
  });

  it('ReturnResponse con cargo por retraso manual: sub-objeto dentro del contrato (null si no hay)', () => {
    expect(toReturnResponse(buildReturnRecord()).manualLateCharge).toBeNull();
    const response = toReturnResponse(
      buildReturnRecord({
        lateChargeAmount: 45.5,
        lateChargeNotes: 'sin aviso',
        lateChargeRegisteredById: 'uid-7',
        lateChargeRegisteredAt: FIXED_NOW,
      }),
    );
    expectMapperMatchesSchema('ReturnResponse', response);
    expectMapperMatchesSchema('ManualLateChargeResponse', response.manualLateCharge as object);
    expect(response.manualLateCharge).toEqual({
      amount: 45.5,
      notes: 'sin aviso',
      registeredById: 'uid-7',
      registeredAt: FIXED_NOW.toISOString(),
    });
  });

  it('ReturnResponse con escalada y documento de responsabilidad: sub-objetos dentro del contrato y sin signatureData', () => {
    const record = buildReturnRecord({
      alcoholEscalationDecision: 'KEEP_IN_CUSTODY',
      alcoholEscalationMarkedRed: true,
      alcoholEscalationNotes: 'Gerencia mantiene custodia',
      alcoholEscalationDecidedById: 'uid-9',
      alcoholEscalationDecidedAt: FIXED_NOW,
      responsibilitySignerName: 'Maria Lopez',
      responsibilitySignerIsHolder: false,
      responsibilitySignerRelation: 'Hermana',
      responsibilitySignatureData: 'data:image/png;base64,SECRET',
      responsibilitySignedAt: FIXED_NOW,
    });
    const response = toReturnResponse(record);
    expectMapperMatchesSchema('AlcoholEscalationResponse', response.alcoholEscalation as object);
    expectMapperMatchesSchema('ResponsibilityDocumentResponse', response.responsibilityDocument as object);
    expect(response.alcoholEscalation).toEqual({
      decision: 'KEEP_IN_CUSTODY',
      markCustomerRed: true,
      notes: 'Gerencia mantiene custodia',
      decidedById: 'uid-9',
      decidedAt: FIXED_NOW.toISOString(),
    });
    expect(response.responsibilityDocument).toEqual({
      signerName: 'Maria Lopez',
      signerIsHolder: false,
      signerRelationToHolder: 'Hermana',
      signedAt: FIXED_NOW.toISOString(),
    });
    expect(JSON.stringify(response)).not.toContain('SECRET');
    expect(JSON.stringify(response)).not.toContain('signatureData');
  });

  it('ReturnResponse sin escalada ni documento los expone como null', () => {
    const response = toReturnResponse(buildReturnRecord());
    expect(response.alcoholEscalation).toBeNull();
    expect(response.responsibilityDocument).toBeNull();
  });

  it('assess-damage expone customerRiskStatus y el catálogo de tarifario respeta su schema', () => {
    const damage = toReturnDamageResponse(buildTechnicalDamage(), buildReturnRecord({ version: 9 }), 'AMBAR');
    expectMapperMatchesSchema('ReturnDamageResponse', damage);
    expect(damage.customerRiskStatus).toBe('AMBAR');
    expect(toReturnDamageResponse(buildTechnicalDamage()).customerRiskStatus).toBeUndefined();

    const tariff = toCosmeticTariffResponse(listCosmeticTariff());
    expectMapperMatchesSchema('CosmeticTariffResponse', tariff);
    expectMapperMatchesSchema('CosmeticTariffItem', tariff.items[0]);
    expect(tariff.items).toHaveLength(COSMETIC_DAMAGE_TARIFF.size);
    expect(tariff.items[0]).toEqual({ code: 'PULIDO_Y_ENCERADO', name: 'Pulido y encerado', pricePen: 30 });
  });

  it('ReturnDamageResponse e ImmobilizationChargeResponse de los comandos exponen la versión del expediente', () => {
    const record = buildReturnRecord({ version: 9 });
    const damage = toReturnDamageResponse(buildTechnicalDamage(), record);
    const charge = toImmobilizationChargeResponse(buildCharge(), record);
    expectMapperMatchesSchema('ReturnDamageResponse', damage);
    expectMapperMatchesSchema('ImmobilizationChargeResponse', charge);
    expect(damage).toMatchObject({ returnVersion: 9, returnEtag: '"9"' });
    expect(charge).toMatchObject({ returnVersion: 9, returnEtag: '"9"' });
  });

  it('ReturnEvidenceResponse coincide con el contrato', () => {
    expectMapperMatchesSchema(
      'ReturnEvidenceResponse',
      toReturnEvidenceResponse({
        id: 'ev-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        returnId: 'ret-1',
        type: 'PHOTO',
        zone: 'capot',
        objectUrl: 'https://storage.googleapis.com/b/o.jpg',
        uploadedBy: 'uid-1',
        uploadedAt: new Date('2026-10-05T12:00:00Z'),
      }),
    );
  });

  it('ReturnEvidenceUploadSessionResponse: el controller devuelve exactamente uploadUrl, objectUrl y expiresAt', () => {
    const contract = flatten(spec.components.schemas.ReturnEvidenceUploadSessionResponse);
    expect(Object.keys(contract.properties).sort()).toEqual(['expiresAt', 'objectUrl', 'uploadUrl']);
    expect([...contract.required].sort()).toEqual(['expiresAt', 'objectUrl', 'uploadUrl']);
  });

  it('GET /returns/reminders y /returns/alerts: query params = DTO, límites = runtime y declarados antes de :id', () => {
    const queryNames = (op: Operation) =>
      (op.parameters ?? [])
        .map(deref)
        .filter((p: any) => p.in === 'query')
        .map((p: any) => p.name)
        .sort();
    const reminders: Operation = spec.paths['/returns/reminders'].get;
    const alerts: Operation = spec.paths['/returns/alerts'].get;
    expect(queryNames(reminders)).toEqual(dtoFields(ListReturnRemindersQueryDto).all);
    expect(queryNames(alerts)).toEqual(dtoFields(ListReturnAlertsQueryDto).all);
    const limitOf = (op: Operation) => (op.parameters ?? []).map(deref).find((p: any) => p.name === 'limit').schema;
    expect({ maximum: limitOf(reminders).maximum, default: limitOf(reminders).default }).toEqual({
      maximum: RETURN_REMINDER_LIST_MAX_LIMIT,
      default: RETURN_REMINDER_LIST_DEFAULT_LIMIT,
    });
    expect({ maximum: limitOf(alerts).maximum, default: limitOf(alerts).default }).toEqual({
      maximum: RETURN_ALERT_LIST_MAX_LIMIT,
      default: RETURN_ALERT_LIST_DEFAULT_LIMIT,
    });
    const names = Object.getOwnPropertyNames(ReturnsController.prototype);
    expect(names.indexOf('reminders')).toBeLessThan(names.indexOf('detail'));
    expect(names.indexOf('alerts')).toBeLessThan(names.indexOf('detail'));
  });

  it('register-reminder: 200, If-Match, 404/409/412/422/428 documentados e idempotente', () => {
    const op: Operation = spec.paths['/returns/{id}/commands/register-reminder'].post;
    expect(op.operationId).toBe('registerReturnReminder');
    expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['200', '403', '404', '409', '412', '422', '428']));
    const route = routes.find((r) => r.name === 'registerReminderCommand');
    expect(route).toMatchObject({ openApiPath: '/returns/{id}/commands/register-reminder', httpCode: 200, idempotent: true });
  });

  it('ReturnResponse expone reminder (null sin recordatorio) y alerts solo cuando la consulta las calcula', () => {
    const bare = toReturnResponse(buildReturnRecord());
    expect(bare.reminder).toBeNull();
    expect(bare).not.toHaveProperty('alerts');

    const withAll = toReturnResponse(
      buildReturnRecord({
        reminder: buildReminder({ status: 'FAILED', sentAt: FIXED_NOW, sentBy: 'uid-1', resultNote: 'No contestó', attempts: 1, version: 2 }),
        alerts: {
          warrantyRelease: { level: 'OVERDUE', deadlineAt: FIXED_NOW, hoursRemaining: -2 },
          immobilization: { since: FIXED_NOW, hoursElapsed: 30, pendingDays: 1, dailyRate: 120, suggestedAmount: 120 },
        },
      }),
    );
    expectMapperMatchesSchema('ReturnResponse', withAll);
    expectMapperMatchesSchema('ReturnReminderResponse', withAll.reminder as object);
    expectMapperMatchesSchema('ReturnAlerts', withAll.alerts as object);
    const withLateness = toReturnResponse(buildReturnRecord({ lateness: { lateToleranceMinutes: 30, lateMinutes: 45, isLate: true, basis: 'NOW' } }));
    expectMapperMatchesSchema('ReturnResponse', withLateness);
    expectMapperMatchesSchema('ReturnLateness', withLateness.lateness as object);
    expect(toReturnResponse(buildReturnRecord())).not.toHaveProperty('lateness');
    const charge = computeReturnLatenessCharge(
      { status: 'INSPECCION', scheduledAt: FIXED_NOW, receivedAt: new Date(FIXED_NOW.getTime() + 150 * 60000) },
      FIXED_NOW,
      { dailyRate: 120, deposit: { originalAmount: 1000, currency: 'PEN' }, extensions: [] },
    );
    const withCharge = toReturnResponse(buildReturnRecord({ latenessCharge: charge }));
    expectMapperMatchesSchema('ReturnResponse', withCharge);
    expectMapperMatchesSchema('ReturnLatenessCharge', withCharge.latenessCharge as object);
    expect(withCharge.latenessCharge).toMatchObject({ tier: 'EXTRA_121_300', suggestedTimeCharge: '60.00', suggestedGuaranteePenalty: '300.00' });
    expectMapperMatchesSchema('ReturnLatenessCharge', computeReturnLatenessCharge(
      { status: 'INSPECCION', scheduledAt: FIXED_NOW, receivedAt: FIXED_NOW }, FIXED_NOW, { dailyRate: null }) as object);
    expect(toReturnResponse(buildReturnRecord())).not.toHaveProperty('latenessCharge');
    expectMapperMatchesSchema('WarrantyReleaseAlert', withAll.alerts!.warrantyRelease as object);
    expectMapperMatchesSchema('ImmobilizationAlert', withAll.alerts!.immobilization as object);
    expect(withAll.reminder).toMatchObject({ status: 'FAILED', text: expect.any(String), note: 'No contestó', version: 2, etag: '"2"' });
  });

  it('ReturnReminderInboxItem y ReturnAlertItem coinciden con el contrato', () => {
    const item = toReminderInboxItemResponse({
      reminder: buildReminder(),
      returnId: 'ret-1',
      rentalId: 'rent-1',
      returnStatus: 'PROGRAMADA',
      scheduledAt: FIXED_NOW,
      vehiclePlate: 'ABC-123',
      customerName: 'Juan Perez',
      customerPhone: '999888777',
    });
    expectMapperMatchesSchema('ReturnReminderInboxItem', item);
    expectMapperMatchesSchema('ReturnReminderResponse', item.reminder);
    expect(toReturnReminderResponse(buildReminder()).sentAt).toBeNull();

    const alert = toReturnAlertItemResponse({
      type: 'WARRANTY_RELEASE',
      returnId: 'ret-1',
      rentalId: 'rent-1',
      returnStatus: 'SIN_DANOS',
      returnVersion: 4,
      vehiclePlate: 'ABC-123',
      customerName: 'Juan Perez',
      receivedAt: FIXED_NOW,
      warrantyRelease: { level: 'DUE_SOON', deadlineAt: FIXED_NOW, hoursRemaining: 3.5 },
      immobilization: null,
    });
    expectMapperMatchesSchema('ReturnAlertItem', alert);
  });

  it('contrato 1.7.0', () => {
    expect(spec.info.version).toBe('1.7.0');
  });
});
