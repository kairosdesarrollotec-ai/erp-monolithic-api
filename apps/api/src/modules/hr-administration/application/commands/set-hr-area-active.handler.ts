import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaRepositoryPort, type HrAreaAdminView } from '../ports/hr-area-repository.port';
import { HrAreaInUseError, HrAreaNotFoundError } from '../../domain/hr-administration-errors';
import { areaCodeFromText } from '../../domain/hr-area-rules';
import { SetHrAreaActiveCommand } from './set-hr-area-active.command';

/**
 * Activa / desactiva un area del catalogo (solo Gerencia General, MANAGE_AREAS). Desactivar la quita de GET /hr-areas y de las
 * altas nuevas, pero conserva los datos historicos; se rechaza (409 HR_AREA_IN_USE) si hay colaboradores activos asignados.
 * Idempotente: repetir el mismo estado no falla ni audita.
 */
@Injectable()
export class SetHrAreaActiveHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly areas: HrAreaRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: SetHrAreaActiveCommand): Promise<HrAreaAdminView> {
    const { scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'MANAGE_AREAS',
    );
    const code = areaCodeFromText(command.code);
    return this.transactionManager.run(async (tx) => {
      const area = await this.areas.findByCode(scope.operatingCompanyId, code, tx);
      if (!area) throw new HrAreaNotFoundError(command.code);
      if (area.isActive === command.isActive) return area;
      if (!command.isActive) {
        const inUse = await this.areas.countActiveEmployees(scope.operatingCompanyId, code, tx);
        if (inUse > 0) throw new HrAreaInUseError(area.name, inUse);
      }
      const updated = await this.areas.setActive(scope.operatingCompanyId, code, command.isActive, tx);
      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: scope.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'hr_area',
          entityId: `${scope.operatingCompanyId}:${code}`,
          action: command.isActive ? 'HR_AREA_ACTIVATED' : 'HR_AREA_DEACTIVATED',
          changes: { code, name: area.name, companyId: scope.operatingCompanyId },
        },
        tx,
      );
      return updated;
    });
  }
}
