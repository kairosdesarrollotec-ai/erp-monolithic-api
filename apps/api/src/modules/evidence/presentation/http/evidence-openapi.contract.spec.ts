import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import * as yaml from 'js-yaml';
import { EvidenceDeletionController } from './evidence-deletion.controller';
import {
  ApproveEvidenceDeletionDto,
  RejectEvidenceDeletionDto,
  RequestEvidenceDeletionDto,
} from './dto/evidence-deletion.dto';
import { toEvidenceDeletionResponse } from './evidence-deletion.mapper';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import * as errors from '../../domain/evidence-deletion-errors';
import { EVIDENCE_DELETION_STATUSES, EVIDENCE_DELETION_TARGET_KINDS } from '../../domain/evidence-deletion-types';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';

/** Contrato packages/contracts/openapi/evidence.yaml vs backend (rutas, codigos, DTOs, enums, respuesta y errores). */
const SPEC_PATH = path.resolve(__dirname, '../../../../../../../packages/contracts/openapi/evidence.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8')) as any;

function dtoFields(dto: new () => unknown): { all: string[]; required: string[] } {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', true, false);
  const all = [...new Set(metas.map((m) => m.propertyName))].sort();
  const optional = new Set(metas.filter((m) => m.type === 'conditionalValidation').map((m) => m.propertyName));
  return { all, required: all.filter((p) => !optional.has(p)).sort() };
}

const HTTP: Record<number, string> = { [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post' };

function routes() {
  const proto = EvidenceDeletionController.prototype as any;
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor' && Reflect.hasMetadata(METHOD_METADATA, proto[n]))
    .map((name) => {
      const handler = proto[name];
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const method = HTTP[Reflect.getMetadata(METHOD_METADATA, handler)];
      return {
        method,
        openApiPath: `/evidence/deletion-requests${sub === '/' ? '' : `/${sub}`}`.replace(/:(\w+)/g, '{$1}'),
        httpCode: Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === 'post' ? 201 : 200),
        idempotent: ((Reflect.getMetadata(INTERCEPTORS_METADATA, handler) ?? []) as unknown[]).includes(IdempotencyInterceptor),
      };
    });
}

describe('Contrato OpenAPI evidence.yaml vs backend', () => {
  it('version del contrato 1.0.0 (contrato nuevo)', () => {
    expect(spec.info.version).toBe('1.0.0');
  });

  it('cada ruta del controller existe en OpenAPI y viceversa', () => {
    const fromController = routes().map((r) => `${r.method} ${r.openApiPath}`).sort();
    const fromSpec = Object.entries(spec.paths).flatMap(([p, ops]: [string, any]) => Object.keys(ops).map((m) => `${m} ${p}`)).sort();
    expect(fromController).toEqual(fromSpec);
  });

  it('codigo de exito declarado = el de NestJS; los POST aceptan Idempotency-Key e IdempotencyInterceptor', () => {
    for (const r of routes()) {
      const op = spec.paths[r.openApiPath][r.method];
      expect({ op: op.operationId, success: Object.keys(op.responses).filter((c) => c.startsWith('2')) }).toEqual({ op: op.operationId, success: [String(r.httpCode)] });
      const names = (op.parameters ?? []).map((p: any) => p.name);
      expect({ op: op.operationId, key: names.includes('Idempotency-Key') }).toEqual({ op: op.operationId, key: r.method === 'post' });
      expect({ op: op.operationId, interceptor: r.idempotent }).toEqual({ op: op.operationId, interceptor: r.method === 'post' });
    }
  });

  it.each([
    ['RequestEvidenceDeletionRequest', RequestEvidenceDeletionDto],
    ['ApproveEvidenceDeletionRequest', ApproveEvidenceDeletionDto],
    ['RejectEvidenceDeletionRequest', RejectEvidenceDeletionDto],
  ])('%s: mismos campos y mismos obligatorios que el DTO', (schema, dto) => {
    const contract = spec.components.schemas[schema];
    const fields = dtoFields(dto as new () => unknown);
    expect(Object.keys(contract.properties).sort()).toEqual(fields.all);
    expect([...contract.required].sort()).toEqual(fields.required);
  });

  it('enums y limites del contrato = dominio', () => {
    const s = spec.components.schemas;
    expect(s.EvidenceDeletionStatus.enum).toEqual([...EVIDENCE_DELETION_STATUSES]);
    expect(s.EvidenceDeletionTargetKind.enum).toEqual([...EVIDENCE_DELETION_TARGET_KINDS]);
    expect(s.RequestEvidenceDeletionRequest.properties.reason).toMatchObject({
      minLength: errors.EVIDENCE_DELETION_MIN_REASON_LENGTH,
      maxLength: errors.EVIDENCE_DELETION_MAX_REASON_LENGTH,
    });
  });

  it('la respuesta del mapper tiene exactamente los campos del contrato (todos obligatorios)', () => {
    const response = toEvidenceDeletionResponse({
      request: {
        id: 'r1', organizationId: 'o', operatingCompanyId: 'c', branchId: 'b', targetKind: 'RENTAL', parentId: 'p', evidenceId: 'e',
        evidenceSnapshot: { type: 'PHOTO', zone: 'Z', objectUrl: 'u', uploadedBy: 'x', uploadedAt: '2026-10-21T00:00:00.000Z' },
        reason: 'motivo', status: 'PENDING', requestedBy: 'u', requestedAt: new Date(), firstApprovedBy: null, firstApprovedAt: null,
        firstApprovalNote: null, secondApprovedBy: null, secondApprovedAt: null, secondApprovalNote: null, rejectedBy: null,
        rejectedAt: null, rejectionReason: null, executedAt: null, expiredAt: null, expiresAt: new Date(), version: 1,
        createdAt: new Date(), updatedAt: new Date(),
      },
      viewer: { canApprove: false, canReject: false },
    });
    const sc = spec.components.schemas.EvidenceDeletionRequest;
    expect(Object.keys(response).sort()).toEqual(Object.keys(sc.properties).sort());
    expect([...sc.required].sort()).toEqual(Object.keys(sc.properties).sort());
    expect(Object.keys(response.evidence).sort()).toEqual(Object.keys(spec.components.schemas.EvidenceDeletionEvidence.properties).sort());
    expect(JSON.stringify(response)).not.toContain('gs://');
    expect(Object.keys(response)).not.toContain('objectUrl');
  });

  it('los codigos de error documentados existen en el dominio (y viceversa)', () => {
    const documented = (spec.components.schemas.DomainErrorResponse.properties.code.description as string)
      .match(/[A-Z][A-Z_]{5,}/g)!
      .filter((c) => c.startsWith('EVIDENCE_'));
    const implemented = Object.values(errors)
      .map((E: any) => {
        try {
          return new E('a', 'b').code as string;
        } catch {
          return undefined;
        }
      })
      .filter((c): c is string => typeof c === 'string');
    expect([...new Set(documented)].sort()).toEqual([...new Set(implemented)].sort());
  });

  it('el catalogo ADM-02 trae el modulo EVIDENCE con las 3 acciones', () => {
    expect(PERMISSION_ACTION_CATALOG.filter((d) => d.module === 'EVIDENCE').map((d) => d.action)).toEqual(['REQUEST_DELETION', 'APPROVE_DELETION', 'DELETE_DIRECT']);
  });
});
