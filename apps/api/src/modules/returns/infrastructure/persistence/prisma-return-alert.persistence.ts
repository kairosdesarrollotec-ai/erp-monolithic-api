import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ListAlertCandidatesFilter,
  ReturnAlertRepositoryPort,
} from '../../application/ports/return-alert-repository.port';
import type { ReturnRecord } from '../../application/ports/return-repository.port';
import { LATE_CHARGE_REGISTRABLE_STATUSES, RETURN_LATE_TOLERANCE_MINUTES } from '../../domain/return-lateness';
import { RETURN_INCLUDE, toReturnRecord } from './return-persistence.mapper';

@Injectable()
export class PrismaReturnAlertPersistence implements ReturnAlertRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(filter: ListAlertCandidatesFilter): Promise<ReturnRecord[]> {
    const clauses: Prisma.RentalReturnWhereInput[] = [];
    if (filter.receivedBefore) {
      clauses.push({
        receivedAt: { not: null, lte: filter.receivedBefore },
        status: 'SIN_DANOS',
      });
    }
    if (filter.closedBefore) {
      // BR-DEV-011 (22-oct-2026): el reloj de paralizacion corre desde el cierre de la devolucion.
      clauses.push({
        status: 'CERRADA',
        closedAt: { not: null, lte: filter.closedBefore },
        damages: { some: { origin: 'TECHNICAL' } },
        receivedAt: { not: null },
      });
    }
    if (filter.includeLateCharge) {
      const lateIds = await this.lateChargeCandidateIds(filter);
      if (lateIds.length > 0) clauses.push({ id: { in: lateIds } });
    }
    if (clauses.length === 0) return [];

    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        organizationId: filter.organizationId,
        operatingCompanyId: filter.operatingCompanyId,
        branchId: filter.branchId,
        OR: clauses,
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      take: filter.limit,
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }

  /**
   * DEC-DEVREM-003: Prisma no compara dos columnas con un desplazamiento, así que el retraso (> tolerancia sobre la hora
   * pactada, BR-DEV-003) se evalúa en SQL para no gastar el `limit` en devoluciones puntuales. Misma regla que
   * computeReturnLateness: recepción estrictamente posterior a scheduledAt + 30 min.
   */
  private async lateChargeCandidateIds(filter: ListAlertCandidatesFilter): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM returns
      WHERE organization_id = ${filter.organizationId}
        AND operating_company_id = ${filter.operatingCompanyId}
        AND branch_id = ${filter.branchId}
        AND received_at IS NOT NULL
        AND late_charge_amount IS NULL
        AND status::text = ANY(${[...LATE_CHARGE_REGISTRABLE_STATUSES]}::text[])
        AND received_at > scheduled_at + (${RETURN_LATE_TOLERANCE_MINUTES} * interval '1 minute')
      ORDER BY received_at ASC, id ASC
      LIMIT ${filter.limit}
    `);
    return rows.map((row) => row.id);
  }
}
