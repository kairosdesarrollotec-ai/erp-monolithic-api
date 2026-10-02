import { Injectable } from '@nestjs/common';
import { CreateRateCardCommand } from './create-rate-card.command';
import { RateCard, RateCardRepositoryPort } from '../ports/rate-card-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetWrite } from '../policies/fleet-role.policy';

@Injectable()
export class CreateRateCardHandler {
  constructor(
    private readonly rateCards: RateCardRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: CreateRateCardCommand): Promise<RateCard> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    assertFleetWrite(context.role);

    return this.rateCards.create({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      amountPerDay: command.amountPerDay,
      currency: command.currency,
      validityHours: command.validityHours,
      effectiveFrom: command.effectiveFrom,
      createdBy: command.firebaseUid,
    });
  }
}
