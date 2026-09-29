import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import type { WorkerRole } from '../../../users/domain/worker-role';
import {
  AdminAssignmentRecord,
  AdminUserRepositoryPort,
  CompanyBranchOwnership,
  CompanyWithBranches,
  CreateOrReactivateAssignmentInput,
} from '../../application/ports/admin-user-repository.port';

type AssignmentWithNamesAndMfa = Prisma.UserCompanyAssignmentGetPayload<{
  select: {
    id: true;
    firebaseUid: true;
    companyId: true;
    branchId: true;
    role: true;
    active: true;
    company: { select: { name: true } };
    branch: { select: { name: true } };
  };
}>;

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listAssignmentsByOrganization(organizationId: string): Promise<AdminAssignmentRecord[]> {
    const assignments: AssignmentWithNamesAndMfa[] = await this.prisma.userCompanyAssignment.findMany({
      where: { organizationId },
      select: {
        id: true,
        firebaseUid: true,
        companyId: true,
        branchId: true,
        role: true,
        active: true,
        company: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: [{ company: { name: 'asc' } }, { branch: { name: 'asc' } }],
    });

    if (assignments.length === 0) return [];

    const uniqueUids = [...new Set(assignments.map((a) => a.firebaseUid))];
    const profiles = await this.prisma.userProfile.findMany({
      where: { firebaseUid: { in: uniqueUids } },
      select: { firebaseUid: true, mfaEnrolledAt: true },
    });
    const mfaByUid = new Map(profiles.map((p) => [p.firebaseUid, p.mfaEnrolledAt]));

    return assignments.map((assignment) => ({
      id: assignment.id,
      firebaseUid: assignment.firebaseUid,
      companyId: assignment.companyId,
      companyName: assignment.company.name,
      branchId: assignment.branchId,
      branchName: assignment.branch.name,
      role: assignment.role,
      active: assignment.active,
      mfaEnrolledAt: mfaByUid.get(assignment.firebaseUid) ?? null,
    }));
  }

  async findCompanyBranchOwnership(
    organizationId: string,
    companyId: string,
    branchId: string,
  ): Promise<CompanyBranchOwnership | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, company: { id: companyId, organizationId } },
      select: { id: true, companyId: true },
    });
    return branch ? { companyId: branch.companyId, branchId: branch.id } : null;
  }

  async createOrReactivateAssignment(
    input: CreateOrReactivateAssignmentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const client = tx ?? this.prisma;
    const assignment = await client.userCompanyAssignment.upsert({
      where: {
        firebaseUid_companyId_branchId: {
          firebaseUid: input.firebaseUid,
          companyId: input.companyId,
          branchId: input.branchId,
        },
      },
      create: {
        organizationId: input.organizationId,
        firebaseUid: input.firebaseUid,
        companyId: input.companyId,
        branchId: input.branchId,
        role: input.role,
        active: true,
      },
      update: {
        role: input.role,
        active: true,
        validUntil: null,
      },
      select: { id: true },
    });
    return { id: assignment.id };
  }

  async deactivateAssignment(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ firebaseUid: string; role: WorkerRole } | null> {
    const client = tx ?? this.prisma;
    const existing = await client.userCompanyAssignment.findFirst({
      where: { id, organizationId },
      select: { firebaseUid: true, role: true },
    });
    if (!existing) return null;

    await client.userCompanyAssignment.updateMany({
      where: { id, organizationId },
      data: { active: false, validUntil: new Date() },
    });
    return { firebaseUid: existing.firebaseUid, role: existing.role };
  }

  async countActiveByRole(organizationId: string, role: WorkerRole, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.prisma;
    return client.userCompanyAssignment.count({
      where: { organizationId, role, active: true },
    });
  }

  async listCompaniesWithBranches(organizationId: string): Promise<CompanyWithBranches[]> {
    const companies = await this.prisma.company.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        branches: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return companies.map((company) => ({
      companyId: company.id,
      companyName: company.name,
      branches: company.branches.map((branch) => ({ branchId: branch.id, branchName: branch.name })),
    }));
  }
}
