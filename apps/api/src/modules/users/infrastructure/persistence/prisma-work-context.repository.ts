import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  WorkContextRepositoryPort,
  WorkContextAssignmentRecord,
  SelectWorkContextInput,
} from '../../application/ports/work-context-repository.port';

@Injectable()
export class PrismaWorkContextRepository implements WorkContextRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAssignmentsByFirebaseUid(
    firebaseUid: string,
  ): Promise<WorkContextAssignmentRecord[]> {
    const now = new Date();
    const assignments = await this.prisma.userCompanyAssignment.findMany({
      where: {
        firebaseUid,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      include: { company: true, branch: true },
      orderBy: [{ company: { name: 'asc' } }, { branch: { name: 'asc' } }],
    });

    return assignments.map(
      (assignment: {
        companyId: string;
        branchId: string;
        company: { name: string };
        branch: { name: string };
      }) => ({
        companyId: assignment.companyId,
        companyName: assignment.company.name,
        branchId: assignment.branchId,
        branchName: assignment.branch.name,
      }),
    );
  }

  async findValidAssignment(
    input: SelectWorkContextInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ organizationId: string } | null> {
    const client = tx ?? this.prisma;
    const now = new Date();
    // findFirst (no findUnique) porque la vigencia (active/validFrom/
    // validUntil) es un filtro adicional fuera de la clave unica
    // compuesta (firebaseUid, companyId, branchId) - hallazgo alto
    // "asignaciones vigentes sin vigencia" de la revision PR#4.
    const assignment = await client.userCompanyAssignment.findFirst({
      where: {
        firebaseUid: input.firebaseUid,
        companyId: input.companyId,
        branchId: input.branchId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });

    return assignment ? { organizationId: assignment.organizationId } : null;
  }
}
