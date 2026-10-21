import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import * as yaml from 'js-yaml';
import { SyncController } from './sync.controller';
import { ResolveSyncConflictDto, SyncChecklistDto, SyncEvidenceDto, SyncFieldDto } from './dto/sync-checklist.dto';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { toSyncChecklistResultResponse, toSyncConflictResponse, toResolveSyncConflictResponse } from './sync.mapper';
import {
  SYNC_CHECKLIST_TYPES,
  SYNC_FIELD_DATA_TYPES,
  SYNC_REASON_MAX_LENGTH,
  SYNC_REASON_MIN_LENGTH,
  SYNC_RESOLUTIONS,
} from '../../domain/sync-types';
import * as syncErrors from '../../domain/sync-errors';
import type { SyncConflictRecord } from '../../application/ports/sync-state-repository.port';

/** Contrato packages/contracts/openapi/sync.yaml vs backend (rutas, codigos, DTOs, enums, respuestas y codigos de error). */
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/sync.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

function deref(node: any): any {
  return node && node.$ref ? node.$ref.replace(/^#\//, '').split('/').reduce((n: any, k: string) => n[k], spec) : node;
}
function flatten(schema: any): { required: string[]; properties: Record<string, any> } {
  const s = deref(schema);
  if (s.allOf) {
    return s.allOf.map(flatten).reduce(
      (acc: any, part: any) => ({ required: [...acc.required, ...part.required], properties: { ...acc.properties, ...part.properties } }),
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

function routes() {
  const proto = SyncController.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[n]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      return {
        name,
        method,
        openApiPath: `/sync/${sub}`.replace(/:(\w+)/g, '{$1}'),
        httpCode: Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200),
        idempotent: ((Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[]).includes(IdempotencyInterceptor),
      };
    });
}

describe('Contrato OpenAPI sync.yaml vs backend', () => {
  it('version del contrato 1.0.0', () => {
    expect(spec.info.version).toBe('1.0.0');
  });

  it('cada ruta del controller existe en OpenAPI y viceversa', () => {
    const fromController = routes().map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths).flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`)).sort();
    expect(fromController).toEqual(fromSpec);
  });

  it('el codigo de exito declarado es el que devuelve NestJS y los POST aceptan Idempotency-Key', () => {
    for (const r of routes()) {
      const op = spec.paths[r.openApiPath][r.method];
      expect({ op: op.operationId, success: Object.keys(op.responses).filter((c) => c.startsWith('2')) }).toEqual({ op: op.operationId, success: [String(r.httpCode)] });
      const names = (op.parameters ?? []).map((p: any) => p.name);
      expect({ op: op.operationId, idempotencyKey: names.includes('Idempotency-Key') }).toEqual({ op: op.operationId, idempotencyKey: r.method === 'post' });
      expect({ op: op.operationId, interceptor: r.idempotent }).toEqual({ op: op.operationId, interceptor: r.method === 'post' });
    }
  });

  it('resolve exige If-Match', () => {
    const params = spec.paths['/sync/conflicts/{conflictId}/commands/resolve'].post.parameters;
    expect(params.find((p: any) => p.name === 'If-Match')?.required).toBe(true);
  });

  it.each([
    ['SyncChecklistRequest', SyncChecklistDto],
    ['SyncFieldInput', SyncFieldDto],
    ['SyncEvidenceInput', SyncEvidenceDto],
    ['ResolveSyncConflictRequest', ResolveSyncConflictDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schema, dto) => {
    const contract = flatten(spec.components.schemas[schema]);
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('enums del contrato = enums del dominio', () => {
    const s = spec.components.schemas;
    expect(s.SyncChecklistType.enum).toEqual([...SYNC_CHECKLIST_TYPES]);
    expect(s.SyncResolution.enum).toEqual([...SYNC_RESOLUTIONS]);
    expect(s.SyncFieldDataType.enum).toEqual([...SYNC_FIELD_DATA_TYPES]);
    expect(s.SyncChecklistStatus.enum).toEqual(['SYNCED', 'SYNC_CONFLICT']);
    expect(s.SyncConflictStatus.enum).toEqual(['OPEN', 'RESOLVED']);
    expect(s.SyncConflictKind.enum).toEqual(['FIELD', 'EVIDENCE']);
    expect(s.ResolveSyncConflictRequest.properties.reason).toMatchObject({ minLength: SYNC_REASON_MIN_LENGTH, maxLength: SYNC_REASON_MAX_LENGTH });
  });

  it('las respuestas del mapper tienen exactamente los campos del contrato', () => {
    const conflict: SyncConflictRecord = {
      id: '00000000-0000-4000-8000-000000000001',
      stateId: 's1',
      organizationId: 'o',
      operatingCompanyId: 'c',
      branchId: 'b',
      checklistType: 'RECEPCION',
      sourceId: 'x',
      rentalId: 'r',
      kind: 'FIELD',
      key: 'fuel',
      serverVersion: { value: 'HALF', by: 'a', at: '2026-10-19T13:00:00.000Z' },
      localVersion: { value: 'FULL', by: 'b', at: '2026-10-19T14:00:00.000Z' },
      localBaseRev: 0,
      status: 'OPEN',
      resolution: null,
      reason: null,
      detectedBy: 'b',
      deviceId: null,
      resolvedBy: null,
      resolvedAt: null,
      version: 1,
      createdAt: new Date('2026-10-19T14:00:01.000Z'),
    };
    const sc = spec.components.schemas;
    expect(Object.keys(toSyncConflictResponse(conflict)).sort()).toEqual(Object.keys(sc.SyncConflict.properties).sort());
    expect(sc.SyncConflict.required.sort()).toEqual(Object.keys(sc.SyncConflict.properties).sort());
    const result = toSyncChecklistResultResponse({
      checklistType: 'RECEPCION',
      sourceId: 'x',
      status: 'SYNC_CONFLICT',
      serverConfirmedAt: null,
      stateVersion: 2,
      appliedFields: [],
      unchangedFields: [],
      discardedFields: [],
      addedEvidence: [],
      duplicateEvidence: [],
      conflicts: [conflict],
    });
    expect(Object.keys(result).sort()).toEqual(Object.keys(flatten(sc.SyncChecklistResult).properties).sort());
    const resolved = toResolveSyncConflictResponse({ conflict, checklistStatus: 'SYNCED', serverConfirmedAt: new Date(), openConflicts: 0 });
    expect(Object.keys(resolved).sort()).toEqual(Object.keys(sc.ResolveSyncConflictResponse.properties).sort());
  });

  it('los codigos de error documentados existen en el dominio (y viceversa)', () => {
    const documented = (spec.components.schemas.DomainErrorResponse.properties.code.description as string)
      .match(/[A-Z][A-Z_]{5,}/g)!
      .filter((c) => c.startsWith('SYNC_'));
    const implemented = Object.values(syncErrors)
      .map((E: any) => {
        try {
          return new E('a', 'b', 'c', 'd').code as string;
        } catch {
          return undefined;
        }
      })
      .filter((c): c is string => typeof c === 'string');
    expect([...new Set(documented)].sort()).toEqual([...new Set(implemented)].sort());
  });
});
