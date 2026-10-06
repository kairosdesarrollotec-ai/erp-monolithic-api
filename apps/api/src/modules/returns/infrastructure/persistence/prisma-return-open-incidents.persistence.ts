import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ReturnOpenIncidentsPort } from '../../application/ports/return-open-incidents.port';
import type { ReturnScope } from '../../application/ports/return-repository.port';

/**
 * Lee la tabla `incidents` (modulo Incidencias) sin importar ese modulo: no hay dependencia circular. Bloquea toda
 * incidencia ABIERTA de la empresa ligada al alquiler o a la devolucion del expediente.
 */
@Injectable()
export class PrismaReturnOpenIncidentsPersistence implements ReturnOpenIncidentsPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOpenIncidentIds(
    input: { rentalId: string; returnId: string; scope: ReturnScope },
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const client = tx ?? this.prisma;
    const rows = await client.incident.findMany({
      where: {
        organizationId: input.scope.organizationId,
        operatingCompanyId: input.scope.operatingCompanyId,
        status: 'ABIERTA',
        OR: [{ rentalId: input.rentalId }, { returnId: input.returnId }],
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => row.id);
  }
}
