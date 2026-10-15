import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RentalRecord, RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  AuthorizedDriverAddendumRequiredError,
  NaturalPersonOwnDriverNotAllowedError,
  RentalDriverAlreadyRegisteredError,
  RentalDriverRegistrationClosedError,
  RentalHolderTypeMismatchError,
  RentalHolderTypeRequiredError,
} from '../../domain/rental-errors';
import { holderTypeFromContractVariant, type HolderType } from '../../domain/contract-variant';
import { RegisterAuthorizedDriverCommand } from './register-authorized-driver.command';

/** Estados previos a la entrega en que aun se define quien maneja (ALQ-P03). */
const DRIVER_REGISTRATION_STATUSES: ReadonlySet<string> = new Set([
  'VALIDATION',
  'NOTARY_EVALUATION',
  'CONTRACTING',
  'PENDING_DELIVERY',
]);

/**
 * DEC-ALQ-OWN-DRIVER-005 (Ficha AS-IS Alquiler; BDD ALQ-P03 / BR-ALQ-015): conductor propio.
 *  - Persona NATURAL: NO esta permitido un conductor distinto del titular (conduce quien alquila, o se pide el
 *    conductor de la empresa) -> 422 NATURAL_PERSON_OWN_DRIVER_NOT_ALLOWED. Criterio conservador: no se modela
 *    ninguna excepcion de "acompanante autorizado" porque la documentacion no define como se documenta.
 *  - Persona JURIDICA: SI; el conductor autorizado se registra como party rol DRIVER con la referencia de la adenda
 *    que firma aparte.
 * Permiso: reutiliza RENTAL.FORMALIZE_CONTRACT (definir firmante/conductor es parte de la formalizacion).
 */
@Injectable()
export class RegisterAuthorizedDriverHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterAuthorizedDriverCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'FORMALIZE_CONTRACT', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    return this.transactionManager.run(async (tx) => {
      const rental = await this.rentals.findById(command.id, scope, tx);
      if (!rental) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (!DRIVER_REGISTRATION_STATUSES.has(rental.status)) {
        throw new RentalDriverRegistrationClosedError(rental.status);
      }

      const holderType = this.resolveHolderType(rental.contract?.contractVariant ?? null, command.holderType);
      if (holderType === 'NATURAL') {
        throw new NaturalPersonOwnDriverNotAllowedError();
      }

      const addendumDocumentRef = command.addendumDocumentRef?.trim();
      if (!addendumDocumentRef) {
        throw new AuthorizedDriverAddendumRequiredError();
      }

      if ((rental.parties ?? []).some((p) => p.customerId === command.driverCustomerId)) {
        throw new RentalDriverAlreadyRegisteredError();
      }
      const driver = await this.rentals.findCustomerById(command.driverCustomerId, tx);
      if (!driver || driver.organizationId !== context.organizationId || driver.operatingCompanyId !== context.companyId) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'DRIVER_CUSTOMER_NOT_FOUND',
          detail: 'El conductor indicado no existe como cliente en esta empresa.',
        });
      }

      const updated = await this.rentals.addAuthorizedDriver(
        {
          rentalId: rental.id,
          scope,
          expectedVersion: command.expectedVersion,
          customerId: driver.id,
          addendumDocumentRef,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: rental.id,
          action: 'AUTHORIZED_DRIVER_REGISTERED',
          changes: { driverCustomerId: driver.id, role: 'DRIVER', holderType, addendumDocumentRef },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: rental.id,
          eventType: 'ConductorAutorizadoRegistrado.v1',
          payload: { rentalId: rental.id, driverCustomerId: driver.id, addendumDocumentRef },
        },
        tx,
      );
      return updated;
    });
  }

  private resolveHolderType(contractVariant: string | null, requested: HolderType | undefined): HolderType {
    const fromContract = holderTypeFromContractVariant(contractVariant);
    if (fromContract && requested && fromContract !== requested) {
      throw new RentalHolderTypeMismatchError(fromContract);
    }
    const resolved = fromContract ?? requested;
    if (!resolved) throw new RentalHolderTypeRequiredError();
    return resolved;
  }
}
