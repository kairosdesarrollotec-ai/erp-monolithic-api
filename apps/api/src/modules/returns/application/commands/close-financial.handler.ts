import { Injectable, Optional } from '@nestjs/common';
import { RentalRepositoryPort } from '../../../rentals/application/ports/rental-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnDepositSettlementPort } from '../ports/return-deposit-settlement.port';
import { ReturnOpenIncidentsPort } from '../ports/return-open-incidents.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  ActiveIncidentsBlockCloseError,
  ReturnDepositAlreadySettledError,
  ReturnNoDepositToSettleError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { appendNotes, findOpenIncidents, openIncidentLabel, roundMoney } from '../../domain/return-rules';
import { buildDepositSettlementPlan } from '../../domain/return-settlement';
import { ReturnFuelReadingsPort } from '../ports/return-fuel-readings.port';
import { calculateFuelPenalty, calculateFuelPenaltyByLines } from '../../domain/damage-calculator';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { CloseFinancialCommand } from './close-financial.command';

/**
 * DEV-08 / BR-DEV-001 / DR-DEV-001 - Cierre y balance financiero de la garantía. La garantía NUNCA se liquida con
 * una incidencia abierta (NFR-KAI-008): ni daños pendientes de evaluar ni incidencias ABIERTAS registradas en el módulo Incidencias. Reembolso + retención deben repartir exactamente la garantía y cubrir
 * los cargos de paralización ya imputados. Escribe los ajustes en la garantía del Alquiler (misma transacción).
 */
@Injectable()
export class CloseFinancialHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly settlement: ReturnDepositSettlementPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly openIncidentsPort: ReturnOpenIncidentsPort,
    @Optional() private readonly fuelReadings?: ReturnFuelReadingsPort,
  ) {}

  async execute(command: CloseFinancialCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE_FINANCIAL');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (existing.status !== 'SIN_DANOS' && existing.status !== 'CON_DANOS') {
      throw new ReturnStateConflictError('cerrar financieramente', existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (current.status !== 'SIN_DANOS' && current.status !== 'CON_DANOS') {
        throw new ReturnStateConflictError('cerrar financieramente', current.status);
      }

      // DR-DEV-001: la garantía no se libera con incidencia abierta.
      // Incluye las incidencias ABIERTAS reales del modulo Incidencias ligadas al alquiler/devolucion (INC-01/INC-02).
      const linkedIncidentIds = await this.openIncidentsPort.findOpenIncidentIds(
        { rentalId: current.rentalId, returnId: current.id, scope },
        tx,
      );
      const openIncidents = [...findOpenIncidents(current.status, current.damages ?? []), ...linkedIncidentIds.map(openIncidentLabel)];
      if (openIncidents.length > 0) {
        throw new ActiveIncidentsBlockCloseError(openIncidents);
      }
      assertCanTransitionReturn(current.status, 'CIERRE_FINANCIERO');

      const refundAmount = roundMoney(command.refundAmount);
      const retainedAmount = roundMoney(command.retainedAmount);

      const rental = await this.rentals.findById(current.rentalId, scope, tx);
      const deposit = rental?.deposit ?? null;
      // DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa no hay garantia -> cierre financiero sin liberacion (N/A).
      const depositApplicable = rental?.contract?.depositRequired !== false;
      if (!depositApplicable && (refundAmount > 0 || retainedAmount > 0)) {
        throw new ReturnNoDepositToSettleError();
      }
      const immobilizationTotal = roundMoney(
        (current.immobilizationCharges ?? []).reduce((acc, c) => acc + c.totalAmount, 0),
      );
      const lateChargeTotal = roundMoney(current.lateChargeAmount ?? 0);
      // Decisión 28-oct #1: sin multa registrada a mano, se compara el RNC de entrega con el de devolución (líneas faltantes x
      // precio por línea del vehículo, definido en Flota); sin lecturas o sin precio se usa el cálculo anterior por nivel de recepción.
      let fuelByLines: number | null = null;
      if (this.fuelReadings && (current.fuelPenaltyAmount === null || current.fuelPenaltyAmount === undefined)) {
        const readings = await this.fuelReadings.findLines(
          { vehicleId: current.vehicleId, rentalId: current.rentalId, returnId: current.id, scope },
          tx,
        );
        fuelByLines = calculateFuelPenaltyByLines(readings.deliveryLines, readings.returnLines, current.vehicleFuelPenaltyPerLine);
      }
      const fuelPenaltyTotal = roundMoney(
        current.fuelPenaltyAmount !== null && current.fuelPenaltyAmount !== undefined
          ? current.fuelPenaltyAmount
          : fuelByLines !== null
            ? fuelByLines
            : current.fuelLevelAtReturn
              ? calculateFuelPenalty(current.fuelLevelAtReturn, current.vehicleFuelPenaltyPerLine)
              : 0,
      );
      // Decisión 28-oct (opción 1): si la garantía ya se liquidó antes (p. ej. retenida por una falta grave de ampliación, BR-ALQ-013),
      // el cierre financiero continúa sin mover la garantía; no hay nada que devolver (refundAmount > 0 sería un error).
      const depositAlreadySettled = !!deposit && deposit.status !== 'HELD';
      if (depositAlreadySettled && refundAmount > 0) {
        throw new ReturnDepositAlreadySettledError(deposit!.status);
      }
      const plan = deposit && !depositAlreadySettled
        ? buildDepositSettlementPlan({
            originalAmount: Number(deposit.originalAmount),
            refundAmount,
            retainedAmount,
            immobilizationTotal,
            lateChargeAmount: lateChargeTotal,
            fuelPenaltyAmount: fuelPenaltyTotal,
          })
        : null;

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: 'CIERRE_FINANCIERO',
          finalSettlementAmount: retainedAmount,
          notes: appendNotes(current.notes, command.notes),
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      let depositApplied = false;
      if (plan) {
        const result = await this.settlement.settleDeposit(
          {
            rentalId: updated.rentalId,
            status: plan.status,
            adjustments: plan.adjustments,
            authorizedBy: command.firebaseUid,
          },
          tx,
        );
        depositApplied = result.applied;
      }

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_FINANCIAL_CLOSED',
          changes: {
            returnId: updated.id,
            refundAmount,
            retainedAmount,
            immobilizationTotal,
            lateChargeTotal,
            fuelPenaltyTotal,
            depositApplicable,
            depositAlreadySettled,
            depositStatus: plan?.status,
            depositAdjusted: depositApplied,
            fuelPenaltyReference: fuelPenaltyTotal,
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
            concept: 'DEPOSIT_SETTLEMENT',
            refundAmount,
            retainedAmount,
            depositApplicable,
            depositStatus: plan?.status ?? null,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
