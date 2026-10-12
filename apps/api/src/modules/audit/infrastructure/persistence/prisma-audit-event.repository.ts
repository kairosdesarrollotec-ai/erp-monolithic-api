import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AuditEventRepositoryPort,
  RecordLoginAttemptInput,
  RecordWorkContextSelectionInput,
  RecordReservationEventInput,
  RecordInquiryEventInput,
  RecordAdminEventInput,
  RecordRentalEventInput,
  RecordIncidentEventInput,
  RecordRecruitmentEventInput,
  RecordHrAdministrationEventInput,
  RecordPaymentEventInput,
} from '../../application/ports/audit-event-repository.port';
import {
  AuditEventQueryPort,
  AuditEventRecord,
  ListAuditEventsFilter,
} from '../../application/ports/audit-event-query.port';

@Injectable()
export class PrismaAuditEventRepository implements AuditEventRepositoryPort, AuditEventQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async recordLoginAttempt(input: RecordLoginAttemptInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId ?? 'UNKNOWN',
        actorUserId: input.actorUserId,
        entityType: 'auth',
        entityId: input.email,
        action: 'LOGIN_ATTEMPT',
        changes: { outcome: input.outcome, reason: input.reason },
      },
    });
  }

  async recordWorkContextSelection(
    input: RecordWorkContextSelectionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.firebaseUid,
        entityType: 'work_context',
        entityId: input.firebaseUid,
        action: 'WORK_CONTEXT_SELECTED',
        changes: { companyId: input.companyId, branchId: input.branchId },
      },
    });
  }

  async recordReservationEvent(
    input: RecordReservationEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'reservation',
        entityId: input.reservationId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue, // JsonValue compat
      },
    });
  }

  async recordInquiryEvent(input: RecordInquiryEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: null,
        entityType: 'inquiry',
        entityId: input.inquiryId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue, // JsonValue compat
      },
    });
  }

  async recordAdminEvent(input: RecordAdminEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: input.entityType ?? 'admin_user_assignment',
        entityId: input.entityId ?? input.targetFirebaseUid,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue, // JsonValue compat
      },
    });
  }

  async recordRentalEvent(input: RecordRentalEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'rental',
        entityId: input.rentalId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue, // JsonValue compat
      },
    });
  }

  async recordIncidentEvent(input: RecordIncidentEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'incident',
        entityId: input.incidentId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async recordRecruitmentEvent(input: RecordRecruitmentEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async recordHrAdministrationEvent(input: RecordHrAdministrationEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async recordPaymentEvent(input: RecordPaymentEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'rental_deposit',
        entityId: input.depositId,
        action: input.action,
        changes: input.changes as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * ADM-04 - lectura de audit_events con filtros opcionales (actor,
   * tipo de entidad, rango de fechas). Orden mas reciente primero (la
   * pantalla de auditoria muestra el historial mas nuevo arriba).
   */
  async listEvents(filter: ListAuditEventsFilter): Promise<AuditEventRecord[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId: filter.organizationId,
        ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.dateFrom || filter.dateTo
          ? {
              createdAt: {
                ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
                ...(filter.dateTo ? { lte: filter.dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 100,
    });

    return events.map((event) => ({
      id: event.id,
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      changes: (event.changes as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt,
    }));
  }
}
