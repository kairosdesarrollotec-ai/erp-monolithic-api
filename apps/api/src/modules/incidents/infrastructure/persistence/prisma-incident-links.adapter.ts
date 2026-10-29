import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { IncidentLinksPort, IncidentRentalRef, IncidentReturnRef } from '../../application/ports/incident-links.port';
import type { IncidentScope } from '../../application/ports/incident-repository.port';

/** Lee Alquiler/Devolucion directamente (solo existencia en scope empresa/sede): Incidencias no importa los modulos Rentals/Returns. */
@Injectable()
export class PrismaIncidentLinksAdapter implements IncidentLinksPort {
  constructor(private readonly prisma: PrismaService) {}

  findRental(rentalId: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentRentalRef | null> {
    const client = tx ?? this.prisma;
    return client.rental.findFirst({
      where: {
        id: rentalId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
      select: { id: true, status: true },
    });
  }

  findReturn(returnId: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentReturnRef | null> {
    const client = tx ?? this.prisma;
    return client.rentalReturn.findFirst({
      where: {
        id: returnId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      },
      select: { id: true, rentalId: true },
    });
  }
}
