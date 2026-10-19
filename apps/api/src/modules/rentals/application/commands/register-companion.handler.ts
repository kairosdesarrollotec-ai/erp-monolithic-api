import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RentalRecord, RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  CompanionDriverMustDifferError,
  CompanionNotApplicableForLegalHolderError,
  CompanionReasonRequiredError,
  LicenseVerificationRequiredError,
  RentalDriverAlreadyRegisteredError,
  RentalDriverRegistrationClosedError,
} from '../../domain/rental-errors';
import { resolveRentalHolderType } from '../../domain/holder-type-resolution';
import { assertCompanionWithinCapacity } from '../../domain/passenger-capacity';
import { RegisterCompanionCommand } from './register-companion.command';

/** Estados previos a la entrega en que aun se define quien maneja (ALQ-P03). */
const DRIVER_REGISTRATION_STATUSES: ReadonlySet<string> = new Set([
  'VALIDATION',
  'NOTARY_EVALUATION',
  'CONTRACTING',
  'PENDING_DELIVERY',
]);

/**
 * DEC-ALQ-COMPANION-006 (BDD ALQ-P03 / BR-ALQ-015; Ficha AS-IS "Excepcion de conductor"; Diccionario 1.3):
 * si el titular (persona NATURAL) no puede firmar (p. ej. brevete extranjero no valido), un acompanante con
 * licencia vigente firma como RESPONSABLE del contrato. Se registra como party rol `RESPONSIBLE`.
 * NO convierte al acompanante en conductor: se EXIGE registrar tambien al conductor real (party `DRIVER`,
 * respuesta de Fiorella 16-oct-2026); el responsable legal es quien firma. La licencia no se guarda: solo los
 * checks `companionLicenseVerified`/`driverLicenseVerified`. El maximo de acompanantes es la capacidad de
 * pasajeros del vehiculo (G-05); si el vehiculo anterior no la tiene registrada (NULL) no hay tope (DEC-FLT-CAP-002). El motivo queda en auditoria y en el evento outbox (no hay columna para persistirlo).
 * Permiso: reutiliza RENTAL.FORMALIZE_CONTRACT.
 */
@Injectable()
export class RegisterCompanionHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: RegisterCompanionCommand): Promise<RentalRecord> {
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

      const titular = await this.rentals.findCustomerById(rental.customerId, tx);
      const holderType = resolveRentalHolderType({
        contractVariant: rental.contract?.contractVariant ?? null,
        titularDocumentType: titular?.documentType,
        requested: command.holderType,
      });
      if (holderType === 'LEGAL') {
        throw new CompanionNotApplicableForLegalHolderError();
      }

      const reason = command.reason?.trim();
      if (!reason) {
        throw new CompanionReasonRequiredError();
      }
      // La autorizacion del acompanante es la del firmante: la referencia documental es opcional.
      const addendumDocumentRef = command.addendumDocumentRef?.trim() || null;

      // La licencia no se guarda (ni numero ni vencimiento): solo el check de checklist.
      if (command.companionLicenseVerified !== true) throw new LicenseVerificationRequiredError('COMPANION');
      if (command.driverLicenseVerified !== true) throw new LicenseVerificationRequiredError('DRIVER');
      if (command.driverCustomerId === command.companionCustomerId) throw new CompanionDriverMustDifferError();

      const parties = rental.parties ?? [];
      if (parties.some((p) => p.customerId === command.companionCustomerId || p.customerId === command.driverCustomerId)) {
        throw new RentalDriverAlreadyRegisteredError();
      }
      assertCompanionWithinCapacity(
        rental.vehiclePassengerCapacity,
        parties.filter((p) => p.role === 'RESPONSIBLE').length,
      );

      const companion = await this.findCompanyCustomer(command.companionCustomerId, context, tx);
      if (!companion) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'COMPANION_CUSTOMER_NOT_FOUND',
          detail: 'El acompanante indicado no existe como cliente en esta empresa.',
        });
      }
      const driver = await this.findCompanyCustomer(command.driverCustomerId, context, tx);
      if (!driver) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'DRIVER_CUSTOMER_NOT_FOUND',
          detail: 'El conductor indicado no existe como cliente en esta empresa.',
        });
      }

      const withCompanion = await this.rentals.addAuthorizedDriver(
        {
          rentalId: rental.id,
          scope,
          expectedVersion: command.expectedVersion,
          customerId: companion.id,
          role: 'RESPONSIBLE',
          addendumDocumentRef,
          updatedBy: command.firebaseUid,
        },
        tx,
      );
      // Conductor real (parte DRIVER): su adenda de persona juridica NO aplica aqui (el firmante autoriza).
      const updated = await this.rentals.addAuthorizedDriver(
        {
          rentalId: rental.id,
          scope,
          expectedVersion: withCompanion.version,
          customerId: driver.id,
          role: 'DRIVER',
          addendumDocumentRef: null,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: rental.id,
          action: 'COMPANION_REGISTERED',
          changes: {
            companionCustomerId: companion.id,
            role: 'RESPONSIBLE',
            driverCustomerId: driver.id,
            companionLicenseVerified: true,
            driverLicenseVerified: true,
            holderType,
            reason,
            addendumDocumentRef,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: rental.id,
          eventType: 'AcompananteAutorizadoRegistrado.v1',
          payload: { rentalId: rental.id, companionCustomerId: companion.id, driverCustomerId: driver.id, reason, addendumDocumentRef },
        },
        tx,
      );
      return updated;
    });
  }

  private async findCompanyCustomer(
    id: string,
    context: { organizationId: string; companyId: string },
    tx: Parameters<RentalRepositoryPort['findCustomerById']>[1],
  ) {
    const customer = await this.rentals.findCustomerById(id, tx);
    if (!customer || customer.organizationId !== context.organizationId || customer.operatingCompanyId !== context.companyId) {
      return null;
    }
    return customer;
  }
}
