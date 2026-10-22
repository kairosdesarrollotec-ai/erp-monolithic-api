import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { ReservationDocumentRepositoryPort } from '../ports/reservation-document-repository.port';
import { DocumentsNotUploadedError, ReservationStateConflictError } from '../../domain/reservation-errors';
import { RegisterDocumentsCommand } from './register-documents.command';

/**
 * RES-P10 - solo marca documents_completed_at (exige >= 1 documento subido, 422 DOCUMENTS_NOT_UPLOADED). Nunca crea un
 * vehicle_commitment por si solo (BR-RES-009, DR-RES-002).
 *
 * Ver RegisterPaymentHandler para el detalle de los hallazgos de PR#6
 * corregidos aqui (scope completo + guarda de estado DRAFT).
 */
@Injectable()
export class RegisterDocumentsHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly documents: ReservationDocumentRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: RegisterDocumentsCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'REGISTER_DOCUMENTS', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (existing.status !== 'DRAFT') {
      throw new ReservationStateConflictError('registrar los documentos de', existing.status);
    }

    // Russbel 22-oct-2026 (P2): marcar documentos completos exige documentos REALMENTE subidos (distintos del
    // comprobante de pago). Antes la marca se aceptaba sin ningun archivo.
    if ((await this.documents.countCustomerDocuments(command.id)) === 0) {
      throw new DocumentsNotUploadedError();
    }

    return this.reservations.registerDocuments(command.id, scope, command.expectedVersion);
  }
}
