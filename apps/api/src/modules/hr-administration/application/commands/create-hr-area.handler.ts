import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { HrAreaRepositoryPort, type HrAreaAdminView } from '../ports/hr-area-repository.port';
import { HrAreaAlreadyExistsError, HrAreaNameInvalidError } from '../../domain/hr-administration-errors';
import { areaAliasCode, areaCodeFromText, normalizeAreaText } from '../../domain/hr-area-rules';
import { CreateHrAreaCommand } from './create-hr-area.command';

/**
 * Respuestas 2026-10-20 #17: SOLO Gerencia General (permiso HR_ADMINISTRATION.MANAGE_AREAS) da de alta areas nuevas en el catalogo
 * de la empresa. El codigo se deriva del nombre (mismo algoritmo que el front); 409 si ya existe un area con ese codigo, nombre
 * o alias (p. ej. «RRHH» ya es Talento Humano), activa o inactiva.
 */
@Injectable()
export class CreateHrAreaHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly areas: HrAreaRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: CreateHrAreaCommand): Promise<HrAreaAdminView> {
    const { scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'MANAGE_AREAS',
    );
    const name = command.name.trim().replace(/\s+/g, ' ');
    const code = areaCodeFromText(name);
    if (!code) throw new HrAreaNameInvalidError();

    return this.transactionManager.run(async (tx) => {
      const existing = await this.areas.listAll(scope.operatingCompanyId, tx);
      const aliasCode = areaAliasCode(name);
      const nameKey = normalizeAreaText(name);
      const clash = existing.find((a) => a.code === code || a.code === aliasCode || normalizeAreaText(a.name) === nameKey);
      if (clash) throw new HrAreaAlreadyExistsError(clash.name);

      const created = await this.areas.create(
        {
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          code,
          name,
          description: command.description?.trim() || null,
          sortOrder: (await this.areas.maxSortOrder(scope.operatingCompanyId, tx)) + 10,
        },
        tx,
      );
      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: scope.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'hr_area',
          entityId: `${scope.operatingCompanyId}:${created.code}`,
          action: 'HR_AREA_CREATED',
          changes: { code: created.code, name: created.name, companyId: scope.operatingCompanyId },
        },
        tx,
      );
      return created;
    });
  }
}
