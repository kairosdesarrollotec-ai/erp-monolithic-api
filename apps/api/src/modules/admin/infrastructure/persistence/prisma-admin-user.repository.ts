import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { toWorkerRoleKey } from '../../../users/domain/worker-role';
import {
  AdminAssignmentRecord,
  AdminUserRepositoryPort,
  CompanyBranchOwnership,
  CompanyWithBranches,
  CreateOrReactivateAssignmentInput,
  EffectiveAssignmentRecord,
} from '../../application/ports/admin-user-repository.port';

type AssignmentWithNamesAndMfa = Prisma.UserCompanyAssignmentGetPayload<{
  select: {
    id: true;
    firebaseUid: true;
    companyId: true;
    branchId: true;
    roleRecord: { select: { id: true; name: true; key: true } };
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
        roleRecord: { select: { id: true, name: true, key: true } },
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
      role: {
        id: assignment.roleRecord.id,
        name: assignment.roleRecord.name,
        key: toWorkerRoleKey(assignment.roleRecord.key),
      },
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

  async companyBelongsToOrganization(organizationId: string, companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, organizationId }, select: { id: true } });
    return company !== null;
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
        roleId: input.roleId,
        active: true,
      },
      update: {
        roleId: input.roleId,
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
  ): Promise<{ firebaseUid: string; roleId: string } | null> {
    const client = tx ?? this.prisma;
    const existing = await client.userCompanyAssignment.findFirst({
      where: { id, organizationId },
      select: { firebaseUid: true, roleId: true },
    });
    if (!existing) return null;

    await client.userCompanyAssignment.updateMany({
      where: { id, organizationId },
      data: { active: false, validUntil: new Date() },
    });
    return { firebaseUid: existing.firebaseUid, roleId: existing.roleId };
  }

  async listEffectiveAssignments(organizationId: string, tx?: Prisma.TransactionClient): Promise<EffectiveAssignmentRecord[]> {
    const client = tx ?? this.prisma;
    const now = new Date();
    return client.userCompanyAssignment.findMany({
      where: {
        organizationId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        roleRecord: { active: true },
      },
      select: { id: true, roleId: true, companyId: true, branchId: true },
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
