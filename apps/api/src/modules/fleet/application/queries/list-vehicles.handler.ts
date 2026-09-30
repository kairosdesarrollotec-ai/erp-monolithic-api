import { Injectable } from '@nestjs/common';
import { ListVehiclesQuery } from './list-vehicles.query';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetRead, assertCrossBranchAllowed } from '../policies/fleet-role.policy';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class ListVehiclesHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListVehiclesQuery): Promise<{ items: FleetVehicle[]; total: number }> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    assertFleetRead(context.role);
    assertCrossBranchAllowed(context.role, context.branchId, query.filterBranchId);

    return this.vehicles.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: query.filterBranchId,
      status: query.status,
      search: query.search?.trim(),
      limit: Math.min(Math.max(query.limit, 1), 100),
      offset: Math.max(query.offset, 0),
    });
  }
}
