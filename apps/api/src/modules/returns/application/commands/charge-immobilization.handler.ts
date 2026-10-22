import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  ImmobilizationChargeRecord,
  ReturnRecord,
  ReturnRepositoryPort,
} from '../ports/return-repository.port';
import { ReturnDepositSettlementPort } from '../ports/return-deposit-settlement.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  ImmobilizationClockNotStartedError,
  ImmobilizationPeriodNotElapsedError,
  InvalidImmobilizationChargeError,
  ReturnDamageNotFoundError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { calculateImmobilizationCharge } from '../../domain/damage-calculator';
import { roundMoney } from '../../domain/return-rules';
import { ReturnStatus } from '../../domain/return-status';
import { ChargeImmobilizationCommand } from './charge-immobilization.command';

export interface ChargeImmobilizationResult {
  charge: ImmobilizationChargeRecord;
  rentalReturn: ReturnRecord;
}

/**
 * Estados donde el cobro puede evaluarse. Desde el 22-oct-2026 el reloj arranca al CERRAR la devolucion (CERRADA / closedAt):
 * en CON_DANOS y CIERRE_FINANCIERO el reloj aun no corre y el cobro responde 422 IMMOBILIZATION_CLOCK_NOT_STARTED.
 */
const CHARGEABLE_STATUSES: ReadonlySet<ReturnStatus> = new Set<ReturnStatus>(['CON_DANOS', 'CIERRE_FINANCIERO', 'CERRADA']);

/**
 * DEV-07 / BR-DEV-011 / invariante 6 del TDD - Cobro (tarifa = dailyRate vigente del vehículo, TDD §9.3) de días de paralización: solo procede si transcurrieron
 * más de 24 h naturales desde el CIERRE de la devolución (22-oct-2026; antes: la recepción) con un daño TÉCNICO registrado. Los días cobrados nunca superan
 * los que el reloj justifica (acumulando cobros previos), de modo que reintentos no duplican el cargo.
 */
@Injectable()
export class ChargeImmobilizationHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly settlement: ReturnDepositSettlementPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: ChargeImmobilizationCommand): Promise<ChargeImmobilizationResult> {
    const { context, scope } = await this.access.authorize(command, 'CHARGE_IMMOBILIZATION');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (!CHARGEABLE_STATUSES.has(existing.status)) {
      throw new ReturnStateConflictError('cobrar paralización en', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (!CHARGEABLE_STATUSES.has(current.status)) {
        throw new ReturnStateConflictError('cobrar paralización en', current.status);
      }

      // TDD §9.3: la tarifa diaria sale del dailyRate vigente del vehículo, nunca del cliente.
      if (current.vehicleDailyRate === null || roundMoney(current.vehicleDailyRate) <= 0) {
        throw new InvalidImmobilizationChargeError(
          'El vehículo del alquiler no tiene una tarifa diaria vigente (dailyRate) para calcular el cargo por paralización (TDD §9.3).',
        );
      }
      const dailyRate = roundMoney(current.vehicleDailyRate);
      const totalAmount = roundMoney(command.daysCharged * dailyRate);

      const damages = current.damages ?? [];
      const technicalDamages = damages.filter((d) => d.origin === 'TECHNICAL');
      if (command.damageId) {
        const linked = damages.find((d) => d.id === command.damageId);
        if (!linked) {
          throw new ReturnDamageNotFoundError(command.damageId);
        }
        if (linked.origin !== 'TECHNICAL') {
          throw new InvalidImmobilizationChargeError(
            'El cargo por paralización solo aplica a un daño técnico derivado a informe externo (BR-DEV-011).',
          );
        }
      } else if (technicalDamages.length === 0) {
        throw new InvalidImmobilizationChargeError(
          'No existe un daño técnico registrado en esta devolución: no corresponde cargo por paralización (BR-DEV-011).',
        );
      }

      // BR-DEV-011 (22-oct-2026): el reloj de paralizacion arranca al CERRAR la devolucion, no en la recepcion.
      if (current.status !== 'CERRADA' || !current.closedAt) {
        throw new ImmobilizationClockNotStartedError();
      }
      const calculation = calculateImmobilizationCharge(current.closedAt, this.clock.now(), dailyRate);
      if (!calculation.eligible) {
        throw new ImmobilizationPeriodNotElapsedError();
      }
      const alreadyCharged = (current.immobilizationCharges ?? []).reduce((acc, c) => acc + c.daysCharged, 0);
      const remaining = calculation.daysCharged - alreadyCharged;
      if (command.daysCharged > remaining) {
        throw new InvalidImmobilizationChargeError(
          `Los días a cobrar (${command.daysCharged}) exceden los días de paralización pendientes de cobro (${Math.max(remaining, 0)}).`,
        );
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      const charge = await this.returns.addImmobilizationCharge(
        {
          returnId: updated.id,
          damageId: command.damageId,
          daysCharged: command.daysCharged,
          dailyRate,
          totalAmount,
          notes: command.notes,
        },
        tx,
      );

      const ledger = await this.settlement.recordImmobilizationCharge(
        {
          rentalId: updated.rentalId,
          amount: totalAmount,
          reason: `Cargo por paralización (${command.daysCharged} día(s) x S/ ${dailyRate.toFixed(2)}) - BR-DEV-011`,
          authorizedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_IMMOBILIZATION_CHARGED',
          changes: {
            returnId: updated.id,
            chargeId: charge.id,
            damageId: command.damageId,
            daysCharged: command.daysCharged,
            dailyRate,
            totalAmount,
            depositAdjusted: ledger.applied,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'PagoAjustado.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            customerId: updated.customerId,
            concept: 'IMMOBILIZATION_CHARGE',
            chargeId: charge.id,
            amount: totalAmount,
            daysCharged: command.daysCharged,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return { charge, rentalReturn: updated };
    });
  }
}
