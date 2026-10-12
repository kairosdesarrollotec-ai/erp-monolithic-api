import { Injectable } from '@nestjs/common';
import type { HrMemo, Prisma } from '@prisma/client';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrMemoRepositoryPort } from '../ports/hr-memo-repository.port';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import {
  MEMO_KIND_FIELD_TRIP_LATE,
  MEMO_KIND_REPEATED_ABSENCE,
  MEMO_SOURCE_ATTENDANCE,
  MEMO_SOURCE_FIELD_TRIP,
  buildAbsenceMemoReason,
  buildFieldTripMemoReason,
  shouldGenerateAbsenceMemo,
  shouldGenerateFieldTripMemo,
} from '../../domain/hr-administration-rules';

/** Actor de auditoría de los memos que genera el sistema (BR-ADP-005 / ADP-P03): no hay una persona que los dispare. */
export const SYSTEM_MEMO_ACTOR = 'system:hr-memo';

/**
 * Memorando de advertencia por reincidencia, generado SOLO por el sistema (sin que nadie lo pida):
 * - 4ª tardanza al regresar de una salida a campo (BR-ADP-005: 1ª a 3ª = advertencia, la 4ª = observado + memo).
 * - 2ª falta injustificada del mes (ADP-P03 / ADP-03: "memo si reiterada").
 * Es idempotente por causa (`sourceType + sourceId`) y deja un evento de auditoría al crearse.
 */
@Injectable()
export class HrMemoService {
  constructor(
    private readonly memos: HrMemoRepositoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async onFieldTripLateReturn(
    input: {
      organizationId: string;
      employeeId: string;
      fieldTripId: string;
      destination: string;
      newLateCount: number;
      lateMinutes: number;
      issuedOn: Date;
    },
    tx: Prisma.TransactionClient,
  ): Promise<HrMemo | null> {
    if (!shouldGenerateFieldTripMemo(input.newLateCount)) return null;
    return this.generate(
      {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        kind: MEMO_KIND_FIELD_TRIP_LATE,
        sourceType: MEMO_SOURCE_FIELD_TRIP,
        sourceId: input.fieldTripId,
        violationNumber: input.newLateCount,
        reason: buildFieldTripMemoReason({
          newLateCount: input.newLateCount,
          lateMinutes: input.lateMinutes,
          destination: input.destination,
        }),
        issuedOn: input.issuedOn,
      },
      tx,
    );
  }

  /** Evalúa la reiteración de faltas injustificadas del mes del registro (incluido el propio registro). */
  async onUnjustifiedAbsence(
    input: { organizationId: string; employeeId: string; attendanceId: string; date: Date },
    tx: Prisma.TransactionClient,
  ): Promise<HrMemo | null> {
    const unjustifiedInMonth = await this.attendance.countInMonthOf(
      input.employeeId,
      'FALTA_INJUSTIFICADA',
      input.date,
      tx,
    );
    if (!shouldGenerateAbsenceMemo(unjustifiedInMonth)) return null;
    return this.generate(
      {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        kind: MEMO_KIND_REPEATED_ABSENCE,
        sourceType: MEMO_SOURCE_ATTENDANCE,
        sourceId: input.attendanceId,
        violationNumber: unjustifiedInMonth,
        reason: buildAbsenceMemoReason({
          unjustifiedInMonth,
          date: input.date.toISOString().slice(0, 10),
        }),
        issuedOn: input.date,
      },
      tx,
    );
  }

  private async generate(
    data: {
      organizationId: string;
      employeeId: string;
      kind: string;
      sourceType: string;
      sourceId: string;
      violationNumber: number;
      reason: string;
      issuedOn: Date;
    },
    tx: Prisma.TransactionClient,
  ): Promise<HrMemo> {
    const { memo, created } = await this.memos.createIfAbsent(data, tx);
    if (created) {
      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: data.organizationId,
          actorUserId: SYSTEM_MEMO_ACTOR,
          entityType: 'memo',
          entityId: memo.id,
          action: 'MEMO_GENERATED',
          changes: {
            employeeId: memo.employeeId,
            kind: memo.kind,
            sourceType: memo.sourceType,
            sourceId: memo.sourceId,
            violationNumber: memo.violationNumber,
            issuedOn: memo.issuedOn,
          },
        },
        tx,
      );
    }
    return memo;
  }
}
