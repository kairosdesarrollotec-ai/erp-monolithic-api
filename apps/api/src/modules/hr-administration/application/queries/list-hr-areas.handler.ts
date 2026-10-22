import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaRepositoryPort, type HrAreaAdminView } from '../ports/hr-area-repository.port';
import { ListHrAreasQuery } from './list-hr-areas.query';

/**
 * H-02: catalogo de areas de RR.HH. de la empresa. Lo consultan quienes ven o gestionan personal o programan vacaciones
 * (permisos existentes de HR_ADMINISTRATION). `includeInactive` exige MANAGE_AREAS (Gerencia General).
 */
@Injectable()
export class ListHrAreasHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly areas: HrAreaRepositoryPort,
  ) {}

  async execute(query: ListHrAreasQuery): Promise<HrAreaAdminView[]> {
    const scopeInput = { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId };
    if (query.includeInactive) {
      const { scope } = await this.access.authorize(scopeInput, 'MANAGE_AREAS');
      return this.areas.listAll(scope.operatingCompanyId);
    }
    const { scope } = await this.access.authorizeAny(scopeInput, ['VIEW_EMPLOYEES', 'MANAGE_EMPLOYEES', 'SCHEDULE_VACATION']);
    const active = await this.areas.listActive(scope.operatingCompanyId);
    return active.map((a) => ({ ...a, isActive: true }));
  }
}
