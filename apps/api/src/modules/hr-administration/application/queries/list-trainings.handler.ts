import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { TrainingRepositoryPort, TrainingWithAttendees } from '../ports/training-repository.port';
import { ListTrainingsQuery } from './list-trainings.query';

/** Talleres de la sede del contexto de trabajo (más recientes primero). */
@Injectable()
export class ListTrainingsHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly trainings: TrainingRepositoryPort,
  ) {}

  async execute(query: ListTrainingsQuery): Promise<TrainingWithAttendees[]> {
    const { scope } = await this.access.authorizeAny(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      ['VIEW_EMPLOYEES', 'REGISTER_TRAINING'],
    );
    return this.trainings.findMany({ companyId: scope.operatingCompanyId, branchId: scope.branchId, limit: query.limit });
  }
}
