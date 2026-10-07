import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  RentalStateConflictError,
  ExtensionAdvanceNoticeError,
  ExtensionMaxDurationError,
} from '../../domain/rental-errors';
import { RequestExtensionCommand } from './request-extension.command';

const ADVANCE_NOTICE_MS = 12 * 60 * 60 * 1000;
const MAX_EXTENSION_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * UC-ALQ-006 / BR-ALQ-012 - Solicitud de Ampliacion de Alquiler.
 * TDD-ALQ-001.md seccion 8 / 9.4.
 * Transiciona Rental de ACTIVE a EXTENSION_PENDING.
 *
 * Supuesto tomado por ambigüedad en BDD/TDD: el "aviso con 12h de anticipación"
 * (BR-ALQ-012) se interpreta como que la solicitud debe llegar al menos 12h
 * ANTES del `expectedEndAt` vigente del alquiler (es decir, el cliente no puede
 * avisar a última hora que necesita más tiempo). No se interpreta como 12h de
 * anticipación respecto al nuevo fin solicitado.
 */
@Injectable()
export class RequestExtensionHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RequestExtensionCommand): Promise<RentalRecord> {
    if (!command.requestedEndAt || Number.isNaN(command.requestedEndAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_REQUESTED_END_AT',
        detail: 'La fecha de fin solicitada para la ampliacion es invalida.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'REQUEST_EXTENSION', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'ACTIVE') {
      throw new RentalStateConflictError('solicitar ampliacion en', existing.status);
    }
    if (!existing.expectedEndAt) {
      throw new BadRequestException({
        code: 'MISSING_EXPECTED_END_AT',
        detail: 'El alquiler no tiene fecha de fin vigente para calcular la ampliacion.',
      });
    }

    const now = new Date();
    if (existing.expectedEndAt.getTime() - now.getTime() < ADVANCE_NOTICE_MS) {
      throw new ExtensionAdvanceNoticeError();
    }

    const extensionSpan = command.requestedEndAt.getTime() - existing.expectedEndAt.getTime();
    if (extensionSpan <= 0 || extensionSpan > MAX_EXTENSION_MS) {
      throw new ExtensionMaxDurationError();
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'ACTIVE') {
        throw new RentalStateConflictError('solicitar ampliacion en', current.status);
      }

      const updated = await this.rentals.requestExtension(
        {
          rentalId: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          requestedEndAt: command.requestedEndAt,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'EXTENSION_REQUESTED',
          changes: {
            requestedEndAt: command.requestedEndAt.toISOString(),
            newStatus: 'EXTENSION_PENDING',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: updated.id,
          eventType: 'AmpliacionSolicitada.v1',
          payload: {
            rentalId: updated.id,
            requestedEndAt: command.requestedEndAt.toISOString(),
          },
        },
        tx,
      );

      return updated;
    });
  }
}
