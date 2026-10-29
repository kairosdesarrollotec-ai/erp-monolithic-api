import { Injectable } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ListRentalsQuery } from './list-rentals.query';

@Injectable()
export class ListRentalsHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: ListRentalsQuery): Promise<RentalRecord[]> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'READ', { companyId: context.companyId, branchId: context.branchId });

    const items = await this.rentals.list({
      organizationId: context.organizationId,
      operatingCompanyId: query.companyId,
      branchId: query.branchId,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    // Decisión 28-oct #11: el alquiler con falta grave de ampliación queda visible como "Incumplimiento grave" en la lista.
    const breached = await this.rentals.findRentalIdsWithExtensionBreach(items.map((r) => r.id));
    return items.map((r) => ({ ...r, hasExtensionBreach: breached.has(r.id) }));
  }
}
