import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { FieldTripRepositoryPort, FieldTripWithEmployee } from '../ports/field-trip-repository.port';
import { FieldTripNotFoundError } from '../../domain/hr-administration-errors';
import { GetFieldTripQuery } from './get-field-trip.query';

@Injectable()
export class GetFieldTripHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly fieldTrips: FieldTripRepositoryPort,
  ) {}

  async execute(query: GetFieldTripQuery): Promise<FieldTripWithEmployee> {
    const fieldTrip = await this.fieldTrips.findById(query.fieldTripId);
    if (!fieldTrip) {
      throw new FieldTripNotFoundError(query.fieldTripId);
    }

    await this.access.authorizeAny(
      {
        firebaseUid: query.firebaseUid,
        companyId: fieldTrip.employee.operatingCompanyId,
        branchId: fieldTrip.employee.branchId,
      },
      ['REQUEST_FIELD_TRIP', 'AUTHORIZE_FIELD_TRIP'],
    );

    return fieldTrip;
  }
}
