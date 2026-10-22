import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';
import { VacancyAreaCatalogPort } from '../ports/vacancy-area-catalog.port';
import { VacancyAreaNotFoundError } from '../../domain/recruitment-errors';
import { RegisterVacancyCommand } from './register-vacancy.command';

@Injectable()
export class RegisterVacancyHandler {
  constructor(
    private readonly access: RecruitmentAccessService,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly areaCatalog: VacancyAreaCatalogPort,
  ) {}

  async execute(command: RegisterVacancyCommand): Promise<VacancyRecord> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'CREATE_VACANCY',
    );

    // 22-oct: el area debe existir y estar activa en el catalogo de la empresa (acepta alias como «RRHH»); se guarda el nombre oficial.
    const area = await this.areaCatalog.resolveActive(scope.operatingCompanyId, command.department);
    if (!area) {
      throw new VacancyAreaNotFoundError(command.department.trim());
    }

    return this.transactionManager.run(async (tx) => {
      const code = await this.vacancies.generateNextCode(scope.operatingCompanyId, tx);

      const created = await this.vacancies.create(
        {
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          branchId: scope.branchId,
          code,
          title: command.title.trim(),
          department: area.name,
          source: command.source,
          isMechanic: command.isMechanic,
          createdBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'vacancy',
          entityId: created.id,
          action: 'VACANCY_REGISTERED',
          changes: {
            code: created.code,
            title: created.title,
            department: created.department,
            source: created.source,
            isMechanic: created.isMechanic,
          },
        },
        tx,
      );

      return created;
    });
  }
}
