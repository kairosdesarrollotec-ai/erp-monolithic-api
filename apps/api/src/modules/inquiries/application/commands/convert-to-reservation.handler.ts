import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord, QuotationRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { InquiryNotTransitionableError, QuotationExpiredError } from '../../domain/inquiry-errors';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import { ReservationRepositoryPort, ReservationRecord } from '../../../reservations/application/ports/reservation-repository.port';
import { ReservationDepositPolicyPort } from '../../../parameters/application/ports/reservation-deposit-policy.port';
import { ConvertToReservationCommand } from './convert-to-reservation.command';

export interface ConvertToReservationResult {
  inquiry: InquiryRecord;
  reservation: ReservationRecord;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * CON-P08/P09 (BR-CON-002) - UC-CON-003. CASO DE USO UNICO para crear una
 * Reserva desde una Consulta: en UNA transaccion (Serializable) transiciona
 * la Consulta COTIZADA -> CONVERTIDA, crea la Reservation vinculada y
 * audita - todo o nada.
 *
 * Revalidacion PR#7 (d7a6124):
 * - CRITICO "cardinalidad Inquiry -> Reservation": ademas de la
 *   transicion condicionada por estado+version, la base garantiza
 *   UNIQUE(reservations.inquiry_id); una conversion concurrente que pierda
 *   la carrera recibe 412 (version) o 409 INQUIRY_ALREADY_CONVERTED, nunca
 *   una segunda reserva. `POST /reservations` ya no crea reservas desde una
 *   consulta (ver CONFLICT-CON-001).
 * - ALTO "cotizaciones vencidas": la cotizacion se elige DENTRO de la
 *   transaccion (la mas reciente, ya ordenada por el repositorio) y debe
 *   estar vigente segun el reloj inyectable (`validUntil > ahora`); si
 *   vencio -> 409 QUOTATION_EXPIRED (hay que volver a cotizar).
 * - ALTO "RBAC": politica `CONVERT_TO_RESERVATION` de Consulta Y `CREATE`
 *   de Reserva (la operacion crea una reserva: exige ambos permisos).
 * - ALTO "Fleet/tarifario provisionales": mismo `ProvisionalQuotingGuard`
 *   que `quote` (la reserva hereda precio/vehiculo del flujo provisional).
 * - BDD-CON-001 10.4: se deriva a Reserva si la fecha es FUTURA - `startAt`
 *   debe ser posterior a ahora (si es inmediata corresponde Alquiler).
 *
 * Precondiciones heredadas (NOTA-PR7): consulta COTIZADA con cliente formal
 * (`Reservation.customerId` es NOT NULL); `endAt = startAt + estimatedDays`
 * de la cotizacion; vehiculo y monto salen de la cotizacion, nunca del
 * payload.
 */
@Injectable()
export class ConvertToReservationHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly quotingGuard: ProvisionalQuotingGuard,
    private readonly clock: ClockPort,
    private readonly depositPolicy: ReservationDepositPolicyPort,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: ConvertToReservationCommand): Promise<ConvertToReservationResult> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'CONVERT_TO_RESERVATION', { companyId: context.companyId, branchId: context.branchId });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CREATE', { companyId: context.companyId, branchId: context.branchId });
    this.quotingGuard.assertReady();

    if (command.startAt.getTime() <= this.clock.now().getTime()) {
      throw new BadRequestException({
        code: 'RESERVATION_START_NOT_IN_FUTURE',
        detail: 'Una reserva se crea para una fecha futura; para una salida inmediata corresponde Alquiler.',
      });
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    const existing = await this.inquiries.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    this.assertConvertible(existing);

    // ADM-03 - lee la version vigente del parametro (ya no un valor fijo
    // en codigo, ver ReservationDepositPolicyPort).
    const depositPolicy = await this.depositPolicy.getCurrent(scope.organizationId);

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.inquiries.findById(command.id, scope, tx);
        if (!current) {
          throw new NotFoundException('Consulta no encontrada.');
        }
        this.assertConvertible(current);

        const quotation = this.currentValidQuotation(current, this.clock.now());
        const startAt = command.startAt;
        const endAt = new Date(startAt.getTime() + quotation.estimatedDays * MS_PER_DAY);

        const converted = await this.inquiries.convertToReservation(
          { id: command.id, ...scope, expectedVersion: command.expectedVersion },
          ['COTIZADA'],
          tx,
        );

        const reservation = await this.reservations.create(
          {
            organizationId: scope.organizationId,
            operatingCompanyId: scope.operatingCompanyId,
            branchId: scope.branchId,
            inquiryId: command.id,
            customerId: current.customerId!,
            vehicleId: quotation.vehicleId,
            channelMode: command.channelMode,
            startAt,
            endAt,
            requiredPaymentAmount: depositPolicy.amount,
            currency: depositPolicy.currency,
            paymentPolicyVersion: depositPolicy.version,
            createdBy: command.firebaseUid,
          },
          tx,
        );

        await this.auditRepository.recordInquiryEvent(
          {
            organizationId: scope.organizationId,
            actorUserId: command.firebaseUid,
            inquiryId: converted.id,
            action: 'INQUIRY_CONVERTED_TO_RESERVATION',
            changes: {
              reservationId: reservation.id,
              quotationId: quotation.id,
              vehicleId: quotation.vehicleId,
              startAt,
              endAt,
            },
          },
          tx,
        );

        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: reservation.id,
            eventType: 'ReservationCreated',
            payload: {
              organizationId: scope.organizationId,
              operatingCompanyId: scope.operatingCompanyId,
              branchId: scope.branchId,
              customerId: reservation.customerId,
              vehicleId: reservation.vehicleId,
              inquiryId: command.id,
              startAt,
              endAt,
              createdBy: command.firebaseUid,
            },
          },
          tx,
        );

        return { inquiry: converted, reservation };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private assertConvertible(inquiry: InquiryRecord): void {
    if (inquiry.status !== 'COTIZADA') {
      throw new InquiryNotTransitionableError(inquiry.status);
    }
    if (!inquiry.customerId) {
      throw new BadRequestException({
        code: 'CUSTOMER_REQUIRED_FOR_CONVERSION',
        detail: 'La consulta no tiene un cliente asociado - no se puede convertir a reserva sin uno.',
      });
    }
  }

  /**
   * La cotizacion VIGENTE es la mas reciente (las anteriores quedan
   * reemplazadas al recotizar) y solo si su `validUntil` es posterior a
   * `now`. No se "salta" a una cotizacion mas antigua: recotizar reemplaza
   * el precio ofrecido.
   */
  private currentValidQuotation(inquiry: InquiryRecord, now: Date): QuotationRecord {
    const [latest] = [...inquiry.quotations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (!latest) {
      throw new InquiryNotTransitionableError(inquiry.status);
    }
    if (latest.validUntil.getTime() <= now.getTime()) {
      throw new QuotationExpiredError(latest.validUntil);
    }
    return latest;
  }
}
