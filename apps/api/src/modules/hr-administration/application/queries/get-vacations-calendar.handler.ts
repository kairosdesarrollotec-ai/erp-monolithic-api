import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort, VacationWithEmployee } from '../ports/vacation-repository.port';
import { GetVacationsCalendarQuery } from './get-vacations-calendar.query';

/** BR-ADP-002: calendario de vacaciones de la empresa para verificar la capacidad del área antes de programar. */
@Injectable()
export class GetVacationsCalendarHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
  ) {}

  async execute(query: GetVacationsCalendarQuery): Promise<VacationWithEmployee[]> {
    const { scope } = await this.access.authorizeAny(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      ['VIEW_EMPLOYEES', 'SCHEDULE_VACATION'],
    );

    return this.vacations.findCalendar(scope.operatingCompanyId, query.year, query.month, query.areaId);
  }
}
