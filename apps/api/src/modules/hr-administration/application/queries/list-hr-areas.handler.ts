import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaRepositoryPort, type HrAreaView } from '../ports/hr-area-repository.port';
import { ListHrAreasQuery } from './list-hr-areas.query';

/**
 * H-02: catalogo de areas de RR.HH. de la empresa (dato de referencia, solo lectura). Lo consultan quienes ven o gestionan
 * personal o programan vacaciones: usa los permisos existentes de HR_ADMINISTRATION (sin permisos nuevos).
 */
@Injectable()
export class ListHrAreasHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly areas: HrAreaRepositoryPort,
  ) {}

  async execute(query: ListHrAreasQuery): Promise<HrAreaView[]> {
    const { scope } = await this.access.authorizeAny(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      ['VIEW_EMPLOYEES', 'MANAGE_EMPLOYEES', 'SCHEDULE_VACATION'],
    );
    return this.areas.listActive(scope.operatingCompanyId);
  }
}
