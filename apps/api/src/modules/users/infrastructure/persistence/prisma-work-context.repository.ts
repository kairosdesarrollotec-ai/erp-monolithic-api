import { Injectable } from '@nestjs/common';
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
    const assignments = await this.prisma.userCompanyAssignment.findMany({
      where: { firebaseUid },
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
  ): Promise<{ organizationId: string } | null> {
    const assignment = await this.prisma.userCompanyAssignment.findUnique({
      where: {
        firebaseUid_companyId_branchId: {
          firebaseUid: input.firebaseUid,
          companyId: input.companyId,
          branchId: input.branchId,
        },
      },
    });

    return assignment ? { organizationId: assignment.organizationId } : null;
  }
}
