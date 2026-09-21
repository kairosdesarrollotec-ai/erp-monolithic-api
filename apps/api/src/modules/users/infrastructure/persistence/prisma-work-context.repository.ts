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
 * Nota de tipado (PROP-003/NOTA-PROP-003, docs/decision-log.md): el
 * cliente Prisma generado en los shells de Claude Code (sandbox en la
 * nube y VM Linux del dispositivo remoto) queda desactualizado respecto
 * al schema real cada vez que este cambia, porque `prisma generate` no
 * tiene salida de red hacia binaries.prisma.sh en esos entornos - solo
 * funciona en una Terminal real de macOS del usuario. Los `as unknown as`
 * de abajo son deliberados: describen la forma REAL que produce el
 * schema actual (incluye `role`, agregado al rebasar PR#5), no un intento
 * de ocultar una incompatibilidad. Cuando el usuario corra
 * `npx prisma generate` en su Terminal, el cliente real coincide con
 * estas formas sin cambios adicionales.
 */
type AssignmentWithRoleAndNames = {
  companyId: string;
  branchId: string;
  role: WorkerRole;
  company: { name: string };
  branch: { name: string };
};

type AssignmentWithOrgAndRole = {
  organizationId: string;
  role: WorkerRole;
};

@Injectable()
export class PrismaWorkContextRepository implements WorkContextRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAssignmentsByFirebaseUid(
    firebaseUid: string,
  ): Promise<WorkContextAssignmentRecord[]> {
    const now = new Date();
    const assignments = (await this.prisma.userCompanyAssignment.findMany({
      where: {
        firebaseUid,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      include: { company: true, branch: true },
      orderBy: [{ company: { name: 'asc' } }, { branch: { name: 'asc' } }],
    })) as unknown as AssignmentWithRoleAndNames[];

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
    const assignment = (await client.userCompanyAssignment.findFirst({
      where: {
        firebaseUid: input.firebaseUid,
        companyId: input.companyId,
        branchId: input.branchId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    })) as unknown as AssignmentWithOrgAndRole | null;

    return assignment
      ? { organizationId: assignment.organizationId, role: assignment.role }
      : null;
  }
}
