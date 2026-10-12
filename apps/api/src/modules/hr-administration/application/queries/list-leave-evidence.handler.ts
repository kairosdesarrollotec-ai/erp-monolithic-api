import { Injectable } from '@nestjs/common';
import type { LeaveEvidence } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { LeaveNotFoundError } from '../../domain/hr-administration-errors';
import { ListLeaveEvidenceQuery } from './list-leave-evidence.query';

/** Evidencia adjunta de un permiso: la ven quien consulta el expediente y quien autoriza (para resolver con sustento). */
@Injectable()
export class ListLeaveEvidenceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
  ) {}

  async execute(query: ListLeaveEvidenceQuery): Promise<LeaveEvidence[]> {
    const leave = await this.leaves.findById(query.leaveId);
    if (!leave) {
      throw new LeaveNotFoundError(query.leaveId);
    }
    await this.access.authorizeAny(
      {
        firebaseUid: query.firebaseUid,
        companyId: leave.employee.operatingCompanyId,
        branchId: leave.employee.branchId,
      },
      ['VIEW_EMPLOYEES', 'AUTHORIZE_LEAVE'],
    );
    return this.leaves.listEvidence(leave.id);
  }
}
