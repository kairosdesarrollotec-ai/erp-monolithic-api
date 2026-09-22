import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  WorkContextRepositoryPort,
  WorkContextAssignmentRecord,
  SelectWorkContextInput,
} from '../../application/ports/work-context-repository.port';
import type { WorkerRole } from '../../domain/worker-role';

/**
 * Hallazgo MEDIO de revision de seguimiento de PR#5 (12fc688, "los casts
 * ocultan la verificacion real del cliente Prisma"): la version anterior
 * de este archivo usaba `as unknown as` para describir a mano la forma
 * que el cliente Prisma "deberia" tener, sin que TypeScript verificara
 * que select/include realmente devuelven eso. Ya se confirmo (PR#4,
 * PR#5) que `npx prisma generate` funciona en una Terminal real y que el
 * CI (.github/workflows/ci.yml) lo corre en cada build/test, asi que el
 * cliente tipado real ya esta disponible - se eliminan los casts y se
 * usan los tipos que Prisma genera con `Prisma.UserCompanyAssignmentGetPayload`,
 * que SI falla en build si el select/include deja de coincidir con el
 * shape usado abajo.
 */
type AssignmentWithRoleAndNames = Prisma.UserCompanyAssignmentGetPayload<{
  select: {
    companyId: true;
    branchId: true;
    role: true;
    company: { select: { name: true } };
    branch: { select: { name: true } };
  };
}>;

type AssignmentWithOrgAndRole = Prisma.UserCompanyAssignmentGetPayload<{
  select: {
    organizationId: true;
    role: true;
  };
}>;

@Injectable()
export class PrismaWorkContextRepository implements WorkContextRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAssignmentsByFirebaseUid(
    firebaseUid: string,
  ): Promise<WorkContextAssignmentRecord[]> {
    const now = new Date();
    const assignments: AssignmentWithRoleAndNames[] =
      await this.prisma.userCompanyAssignment.findMany({
        where: {
          firebaseUid,
          active: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        select: {
          companyId: true,
          branchId: true,
          role: true,
          company: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: [{ company: { name: 'asc' } }, { branch: { name: 'asc' } }],
      });

    return assignments.map((assignment) => ({
      companyId: assignment.companyId,
      companyName: assignment.company.name,
      branchId: assignment.branchId,
      branchName: assignment.branch.name,
      role: assignment.role,
    }));
  }

  async findValidAssignment(
    input: SelectWorkContextInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ organizationId: string; role: WorkerRole } | null> {
    const client = tx ?? this.prisma;
    const now = new Date();
    // findFirst (no findUnique) porque la vigencia (active/validFrom/
    // validUntil) es un filtro adicional fuera de la clave unica
    // compuesta (firebaseUid, companyId, branchId) - hallazgo alto
    // "asignaciones vigentes sin vigencia" de la revision PR#4.
    const assignment: AssignmentWithOrgAndRole | null =
      await client.userCompanyAssignment.findFirst({
        where: {
          firebaseUid: input.firebaseUid,
          companyId: input.companyId,
          branchId: input.branchId,
          active: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        select: {
          organizationId: true,
          role: true,
        },
      });

    return assignment
      ? { organizationId: assignment.organizationId, role: assignment.role }
      : null;
  }
}
