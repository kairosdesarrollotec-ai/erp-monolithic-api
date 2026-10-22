/// <reference types="jest" />
import type { Prisma } from '@prisma/client';
import { ClockPort } from '../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../outbox/application/ports/outbox-event-repository.port';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { isIncidentRoleAllowed, IncidentAction } from '../application/policies/incident-role-policy';
import { IncidentLinksPort } from '../application/ports/incident-links.port';
import {
  AppendIncidentActionInput,
  IncidentActionRecord,
  IncidentDetailRecord,
  IncidentRepositoryPort,
} from '../application/ports/incident-repository.port';
import { IncidentAccessService } from '../application/services/incident-access.service';
import { IncidentTransitionService } from '../application/services/incident-transition.service';
import { roleKeyOfTestRoleId, testRole } from '../../users/testing/role-fixtures';

export const FIXED_NOW = new Date('2026-10-06T15:00:00.000Z');
export const fakeTx = {} as Prisma.TransactionClient;

export function buildAction(overrides: Partial<IncidentActionRecord> = {}): IncidentActionRecord {
  return {
    id: 'act-1',
    incidentId: 'inc-1',
    kind: 'REPORTED',
    description: 'Cliente reporta pérdida de llave',
    authorUserId: 'uid-1',
    createdAt: new Date('2026-10-06T10:00:00.000Z'),
    ...overrides,
  };
}

export function buildIncident(overrides: Partial<IncidentDetailRecord> = {}): IncidentDetailRecord {
  return {
    id: 'inc-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    rentalId: 'rent-1',
    returnId: null,
    type: 'KEY_LOSS',
    severity: 'LEVE',
    status: 'ABIERTA',
    description: 'Cliente reporta pérdida de llave',
    suggestion: null,
    reportedAt: new Date('2026-10-06T10:00:00.000Z'),
    responsibleUserId: 'uid-1',
    resolutionSummary: null,
    resolvedAt: null,
    createdAt: new Date('2026-10-06T10:00:00.000Z'),
    createdBy: 'uid-1',
    updatedAt: new Date('2026-10-06T10:00:00.000Z'),
    updatedBy: 'uid-1',
    version: 1,
    actions: [buildAction()],
    ...overrides,
  };
}

/** Aplica un AppendIncidentActionInput sobre un registro como lo haria el repositorio (version+1, historial append-only). */
export function applyAppend(base: IncidentDetailRecord, input: AppendIncidentActionInput): { incident: IncidentDetailRecord; action: IncidentActionRecord } {
  const action = buildAction({
    id: `act-${base.actions.length + 1}`,
    incidentId: base.id,
    kind: input.kind,
    description: input.description,
    authorUserId: input.authorUserId,
    createdAt: input.now,
  });
  const incident: IncidentDetailRecord = {
    ...base,
    status: input.nextStatus ?? base.status,
    resolutionSummary: input.resolutionSummary ?? base.resolutionSummary,
    resolvedAt: input.resolvedAt ?? base.resolvedAt,
    updatedBy: input.authorUserId,
    updatedAt: input.now,
    version: input.expectedVersion + 1,
    actions: [...base.actions, action],
  };
  return { incident, action };
}

export class FixedClock extends ClockPort {
  now(): Date {
    return new Date(FIXED_NOW);
  }
}

export interface IncidentTestDeps {
  workContext: jest.Mocked<WorkContextAuthorizationService>;
  matrixAuth: jest.Mocked<MatrixAuthorizationService>;
  access: IncidentAccessService;
  incidents: jest.Mocked<IncidentRepositoryPort>;
  links: jest.Mocked<IncidentLinksPort>;
  transactionManager: jest.Mocked<TransactionManagerPort>;
  clock: ClockPort;
  auditRepository: jest.Mocked<AuditEventRepositoryPort>;
  outboxRepository: jest.Mocked<OutboxEventRepositoryPort>;
  transitions: IncidentTransitionService;
}

/** La matriz simulada aplica la misma politica rol-accion que es la version 0 real (incident-role-policy). */
export function buildDeps(options: { role?: WorkerRole } = {}): IncidentTestDeps {
  const role = options.role ?? 'GERENCIA';
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) => {
      const r = roleKeyOfTestRoleId(roleId);
      if (module !== 'INCIDENT' || !isIncidentRoleAllowed(r, action as IncidentAction)) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: `El rol ${r} no tiene permiso para ${module}.${action}` });
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;

  const incidents: jest.Mocked<IncidentRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    appendAction: jest.fn(),
  };
  const links: jest.Mocked<IncidentLinksPort> = {
    findRental: jest.fn().mockResolvedValue({ id: 'rent-1' }),
    findReturn: jest.fn().mockResolvedValue({ id: 'ret-1', rentalId: 'rent-1' }),
  };
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(fakeTx)) as never,
  };
  const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
    recordIncidentEvent: jest.fn().mockResolvedValue(undefined),
    recordRecruitmentEvent: jest.fn().mockResolvedValue(undefined),
    recordHrAdministrationEvent: jest.fn().mockResolvedValue(undefined),
    recordPaymentEvent: jest.fn().mockResolvedValue(undefined),
    recordFleetEvent: jest.fn().mockResolvedValue(undefined),
    recordEvidenceDeletionEvent: jest.fn().mockResolvedValue(undefined),
  };
  const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const clock = new FixedClock();

  return {
    workContext,
    matrixAuth,
    access: new IncidentAccessService(workContext, matrixAuth),
    incidents,
    links,
    transactionManager,
    clock,
    auditRepository,
    outboxRepository,
    transitions: new IncidentTransitionService(incidents, transactionManager, clock, auditRepository, outboxRepository),
  };
}
