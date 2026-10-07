import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RolePermissionMatrixPort } from '../../../admin/application/ports/role-permission-matrix.port';
import { isAllowedByLayers } from '../../../admin/domain/matrix-resolution';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { InterviewerDirectoryPort } from '../ports/interviewer-directory.port';
import {
  INTERVIEWERS_DEFAULT_LIMIT,
  INTERVIEWERS_MAX_LIMIT,
  ListInterviewersQuery,
} from './list-interviewers.query';

export interface InterviewerRecord {
  id: string;
  fullName: string;
}

const UNNAMED_INTERVIEWER = 'Usuario sin nombre';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * REC-05 - buscador de entrevistadores. Lista usuarios con asignacion vigente en la
 * empresa cuyo rol tiene RECRUITMENT.MANAGE_INTERVIEW en la matriz dinamica ADM-02
 * (resuelta con el ambito empresa/sede del contexto, igual que /me/permissions).
 * Autoriza quien tenga MANAGE_INTERVIEW o VIEW_CANDIDATE. Solo expone id y nombre.
 */
@Injectable()
export class ListInterviewersHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly matrix: RolePermissionMatrixPort,
    private readonly directory: InterviewerDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListInterviewersQuery): Promise<InterviewerRecord[]> {
    const { context, scope } = await this.access.authorizeAny(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      ['MANAGE_INTERVIEW', 'VIEW_CANDIDATE'],
    );

    const limit = Math.min(Math.max(query.limit ?? INTERVIEWERS_DEFAULT_LIMIT, 1), INTERVIEWERS_MAX_LIMIT);

    const assignees = await this.directory.listActiveAssignees(
      { organizationId: scope.organizationId, operatingCompanyId: scope.operatingCompanyId },
      this.clock.now(),
    );
    if (assignees.length === 0) return [];

    const layers = await this.matrix.getLayers(context.organizationId, {
      companyId: context.companyId,
      branchId: context.branchId,
    });
    const roleCache = new Map<string, boolean>();
    const canInterview = (roleId: string): boolean => {
      let allowed = roleCache.get(roleId);
      if (allowed === undefined) {
        allowed = isAllowedByLayers(layers, roleId, 'RECRUITMENT', 'MANAGE_INTERVIEW');
        roleCache.set(roleId, allowed);
      }
      return allowed;
    };

    const uids = [...new Set(assignees.filter((a) => canInterview(a.roleId)).map((a) => a.firebaseUid))];
    if (uids.length === 0) return [];

    const names = await this.directory.findDisplayNames(uids);
    const needle = query.search ? normalize(query.search.trim()) : '';

    return uids
      .map((uid) => ({ id: uid, fullName: names[uid]?.trim() || UNNAMED_INTERVIEWER }))
      .filter((item) => needle === '' || normalize(item.fullName).includes(needle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es') || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
