import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RentalDocumentsIncompleteError, RentalStateConflictError } from '../../domain/rental-errors';
import { missingRequiredDocuments, requiredDocumentsFor, resolveNationality } from '../../domain/required-documents';
import { ValidateDocumentsCommand } from './validate-documents.command';

/**
 * ALQ-03 - Validacion documental del cliente e intervinientes (BR-CON-004).
 * Transiciona Rental de DRAFT a VALIDATION.
 */
@Injectable()
export class ValidateDocumentsHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ValidateDocumentsCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'VALIDATE_DOCUMENTS', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (existing.status !== 'DRAFT') {
      throw new RentalStateConflictError('validar documentos en', existing.status);
    }

    // BR-CON-004 (22-oct-2026): el set requerido sale de la nacionalidad del cliente y es obligatorio.
    const customer = await this.rentals.findCustomerById(existing.customerId);
    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', detail: 'El cliente del alquiler no existe.' });
    }
    const nationality = resolveNationality(customer.nationality, customer.documentType);
    const required = requiredDocumentsFor(nationality);
    const missing = missingRequiredDocuments(nationality, command.documentDetails, customer);
    if (missing.length > 0) {
      throw new RentalDocumentsIncompleteError(
        missing.map((doc) => doc.label),
        required.map((doc) => doc.code),
      );
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (current.status !== 'DRAFT') {
        throw new RentalStateConflictError('validar documentos en', current.status);
      }

      const updated = await this.rentals.transitionStatus(
        command.id,
        scope,
        'VALIDATION',
        command.expectedVersion,
        command.firebaseUid,
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.id,
          action: 'DOCUMENTS_VALIDATED',
          changes: {
            fromStatus: 'DRAFT',
            toStatus: 'VALIDATION',
            nationality,
            requiredDocuments: required.map((doc) => doc.code),
            documentDetails: command.documentDetails,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
