import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripRepositoryPort, FieldTripWithEmployee } from '../ports/field-trip-repository.port';
import { ListFieldTripsQuery } from './list-field-trips.query';

@Injectable()
export class ListFieldTripsHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
  ) {}

  async execute(query: ListFieldTripsQuery): Promise<FieldTripWithEmployee[]> {
    const { scope } = await this.access.authorizeAny(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      ['REQUEST_FIELD_TRIP', 'AUTHORIZE_FIELD_TRIP', 'EVALUATE_FIELD_TRIP_RETURN'],
    );

    return this.fieldTrips.findMany({
      companyId: scope.operatingCompanyId,
      branchId: scope.branchId,
      status: query.status,
      employeeId: query.employeeId,
    });
  }
}
