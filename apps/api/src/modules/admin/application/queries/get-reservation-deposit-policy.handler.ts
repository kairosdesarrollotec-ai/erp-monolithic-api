import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ReservationDepositPolicyPort } from '../../../parameters/application/ports/reservation-deposit-policy.port';
import { assertAdminRoleAllowed } from '../policies/admin-role-policy';
import { GetReservationDepositPolicyQuery } from './get-reservation-deposit-policy.query';

export interface ReservationDepositPolicyResult {
  version: number;
  amount: string;
  currency: string;
  effectiveFrom: string | null;
}

/**
 * ADM-03 (Catalogos y parametros) - lee la version vigente + el
 * historial del monto de reserva (contrato punto 5 "valores vigentes",
 * punto 11 "historial de versiones").
 */
@Injectable()
export class GetReservationDepositPolicyHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly depositPolicy: ReservationDepositPolicyPort,
  ) {}

  async execute(
    query: GetReservationDepositPolicyQuery,
  ): Promise<{ current: ReservationDepositPolicyResult; history: ReservationDepositPolicyResult[] }> {
    const context = await this.workContext.authorize({
      firebaseUid: query.actorFirebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    assertAdminRoleAllowed(context.role, 'MANAGE_PARAMETERS');

    const [current, history] = await Promise.all([
      this.depositPolicy.getCurrent(context.organizationId),
      this.depositPolicy.listHistory(context.organizationId),
    ]);

    return {
      current: this.toResult(current),
      history: history.map((item) => this.toResult(item)),
    };
  }

  private toResult(item: { version: number; amount: string; currency: string; effectiveFrom: Date | null }): ReservationDepositPolicyResult {
    return {
      version: item.version,
      amount: item.amount,
      currency: item.currency,
      effectiveFrom: item.effectiveFrom ? item.effectiveFrom.toISOString() : null,
    };
  }
}
