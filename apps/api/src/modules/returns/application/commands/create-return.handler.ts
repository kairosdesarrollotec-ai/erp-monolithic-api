import { Injectable } from '@nestjs/common';
import { RentalRepositoryPort } from '../../../rentals/application/ports/rental-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  RentalAlreadyHasActiveReturnError,
  RentalNotReturnableError,
  ReturnRentalNotFoundError,
} from '../../domain/return-errors';
import { isReturnableRentalStatus } from '../../domain/return-rules';
import { CreateReturnCommand } from './create-return.command';

/**
 * DEV-01 - Programar el expediente de devolución de un alquiler en curso (estado PROGRAMADA, custodia del
 * cliente). No cambia el estado del alquiler: eso ocurre al recibir el vehículo (receive-provisional).
 */
@Injectable()
export class CreateReturnHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CreateReturnCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CREATE');

    const rental = await this.rentals.findById(command.rentalId, scope);
    if (!rental) {
      throw new ReturnRentalNotFoundError(command.rentalId);
    }
    if (!isReturnableRentalStatus(rental.status)) {
      throw new RentalNotReturnableError(rental.status);
    }

    return this.transactionManager.run(async (tx) => {
      const existing = await this.returns.findByRentalId(command.rentalId, scope, tx);
      if (existing) {
        throw new RentalAlreadyHasActiveReturnError(command.rentalId);
      }

      const created = await this.returns.create(
        {
          organizationId: context.organizationId,
          operatingCompanyId: command.companyId,
          branchId: command.branchId,
          rentalId: rental.id,
          vehicleId: rental.vehicleId,
          customerId: rental.customerId,
          scheduledAt: command.scheduledAt,
          notes: command.notes,
          createdBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: rental.id,
          action: 'RETURN_SCHEDULED',
          changes: { returnId: created.id, scheduledAt: command.scheduledAt.toISOString() },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: created.id,
          eventType: 'DevolucionProgramada.v1',
          payload: {
            returnId: created.id,
            rentalId: rental.id,
            vehicleId: rental.vehicleId,
            customerId: rental.customerId,
            scheduledAt: command.scheduledAt.toISOString(),
            organizationId: context.organizationId,
            operatingCompanyId: command.companyId,
            branchId: command.branchId,
          },
        },
        tx,
      );

      return created;
    });
  }
}
