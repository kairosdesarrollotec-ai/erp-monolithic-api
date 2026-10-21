/// <reference types="jest" />
import { ForbiddenException } from '@nestjs/common';
import { isEvidenceRoleAllowed, type EvidenceAction } from '../application/policies/evidence-role-policy';
import { EvidenceAccessService } from '../application/services/evidence-access.service';
import { EvidenceDeletionExpirationService } from '../application/services/evidence-deletion-expiration.service';
import type {
  CreateEvidenceDeletionRequestData,
  EvidenceDeletionPatch,
  EvidenceDeletionRequestRepositoryPort,
  ListEvidenceDeletionFilter,
} from '../application/ports/evidence-deletion-request-repository.port';
import type { EvidenceDeletionTargetPort } from '../application/ports/evidence-deletion-target.port';
import { EvidenceDeletionAlreadyRequestedError } from '../domain/evidence-deletion-errors';
import {
  EVIDENCE_DELETION_OPEN_STATUSES,
  type EvidenceDeletionRequestRecord,
  type EvidenceDeletionStatus,
} from '../domain/evidence-deletion-types';
import { roleKeyOfTestRoleId, testRole } from '../../users/testing/role-fixtures';
import type { WorkerRole } from '../../users/domain/worker-role';

export const ORG = 'org-1';
export const COMPANY = 'comp-1';
export const BRANCH = 'branch-1';
export const FIXED_NOW = new Date('2026-10-21T15:00:00Z');

/** uid -> rol de sistema. */
export const USERS: Record<string, WorkerRole> = {
  'u-req': 'ADMINISTRACION',
  'u-a': 'GERENCIA',
  'u-b': 'ADMINISTRACION',
  'u-admin': 'PLATFORM_ADMIN',
  'u-campo': 'CAMPO',
};

export function buildAccess() {
  const workContext = {
    authorize: jest.fn(async (input: { firebaseUid: string; companyId: string; branchId: string }) => ({
      organizationId: ORG,
      companyId: input.companyId,
      branchId: input.branchId,
      ...testRole(USERS[input.firebaseUid] ?? 'CAMPO'),
    })),
  };
  const matrixAuth = {
    assertAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) => {
      if (module !== 'EVIDENCE' || !isEvidenceRoleAllowed(roleKeyOfTestRoleId(roleId), action as EvidenceAction)) {
        throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: 'no' });
      }
    }),
    isAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) =>
      module === 'EVIDENCE' && isEvidenceRoleAllowed(roleKeyOfTestRoleId(roleId), action as EvidenceAction),
    ),
  };
  return { access: new EvidenceAccessService(workContext as never, matrixAuth as never), workContext, matrixAuth };
}

/** Repositorio en memoria con las MISMAS guardas que el real (estado + version) y el indice unico parcial. */
export function buildMemoryRepo() {
  const rows = new Map<string, EvidenceDeletionRequestRecord>();
  let seq = 0;
  const repo = {
    rows,
    create: jest.fn(async (data: CreateEvidenceDeletionRequestData) => {
      const open = [...rows.values()].find(
        (r) => r.targetKind === data.targetKind && r.evidenceId === data.evidenceId && EVIDENCE_DELETION_OPEN_STATUSES.includes(r.status),
      );
      if (open) throw new EvidenceDeletionAlreadyRequestedError();
      seq = Math.max(seq, rows.size) + 1;
      const record: EvidenceDeletionRequestRecord = {
        id: `req-${seq}`,
        ...data,
        status: 'PENDING',
        firstApprovedBy: null,
        firstApprovedAt: null,
        firstApprovalNote: null,
        secondApprovedBy: null,
        secondApprovedAt: null,
        secondApprovalNote: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        executedAt: null,
        expiredAt: null,
        version: 1,
        createdAt: data.requestedAt,
        updatedAt: data.requestedAt,
      };
      rows.set(record.id, record);
      return { ...record };
    }),
    findById: jest.fn(async (id: string, org: string, company: string) => {
      const r = rows.get(id);
      return r && r.organizationId === org && r.operatingCompanyId === company ? { ...r } : null;
    }),
    findOpenByEvidence: jest.fn(async (kind: string, evidenceId: string, org: string) => {
      const r = [...rows.values()].find(
        (x) => x.targetKind === kind && x.evidenceId === evidenceId && x.organizationId === org && EVIDENCE_DELETION_OPEN_STATUSES.includes(x.status),
      );
      return r ? { ...r } : null;
    }),
    list: jest.fn(async (filter: ListEvidenceDeletionFilter) => [...rows.values()].filter((r) => r.operatingCompanyId === filter.operatingCompanyId).map((r) => ({ ...r }))),
    transition: jest.fn(async (id: string, expected: { statuses: readonly EvidenceDeletionStatus[]; version: number }, patch: EvidenceDeletionPatch) => {
      const r = rows.get(id);
      if (!r || r.version !== expected.version || !expected.statuses.includes(r.status)) return null;
      const next = { ...r, ...patch, version: r.version + 1 };
      rows.set(id, next);
      return { ...next };
    }),
    findDueOpen: jest.fn(async (now: Date) =>
      [...rows.values()].filter((r) => EVIDENCE_DELETION_OPEN_STATUSES.includes(r.status) && r.expiresAt <= now).map((r) => ({ ...r })),
    ),
  };
  return repo as typeof repo & EvidenceDeletionRequestRepositoryPort;
}

export function buildTarget() {
  const target = {
    locate: jest.fn(async () => ({ type: 'PHOTO', zone: 'FRONT', objectUrl: 'gs://b/o', uploadedBy: 'u-campo', uploadedAt: '2026-10-20T10:00:00.000Z' })),
    remove: jest.fn(async () => undefined),
  };
  return target as typeof target & EvidenceDeletionTargetPort;
}

export function buildDeps(now: Date = FIXED_NOW) {
  const { access } = buildAccess();
  const repo = buildMemoryRepo();
  const target = buildTarget();
  const tx = { __tx: true } as never;
  const transactionManager = { run: jest.fn(async (work: (t: never) => Promise<unknown>) => work(tx)) };
  const clock = { now: jest.fn(() => now) };
  const audit = { recordEvidenceDeletionEvent: jest.fn().mockResolvedValue(undefined) };
  const expiration = new EvidenceDeletionExpirationService(repo, transactionManager as never, audit as never);
  return { access, repo, target, tx, transactionManager, clock, audit, expiration };
}
