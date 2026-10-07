import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { RentalEvidenceStoragePort } from '../ports/rental-evidence-storage.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { RequestEvidenceUploadSessionCommand } from './request-evidence-upload-session.command';

// ALQ-09 / BR-INS-003 / BR-INS-004 - mismos limites de tamano que Fleet
// (SDD-00 §16.5) para fotos; el limite de video es un supuesto propio de
// esta tarea (no hay un BR que fije un tamano maximo de video) - ajustar
// si BA/Arquitectura define uno distinto.
export const MAX_EVIDENCE_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_EVIDENCE_VIDEO_BYTES = 200 * 1024 * 1024;

@Injectable()
export class RequestEvidenceUploadSessionHandler {
  constructor(
    private readonly storage: RentalEvidenceStoragePort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(
    command: RequestEvidenceUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'UPLOAD_EVIDENCE', { companyId: context.companyId, branchId: context.branchId });

    const maxBytes = command.type === 'VIDEO' ? MAX_EVIDENCE_VIDEO_BYTES : MAX_EVIDENCE_PHOTO_BYTES;
    if (command.contentLength > maxBytes) {
      throw new PayloadTooLargeException(
        `El archivo supera el tamaño máximo permitido de ${Math.round(maxBytes / (1024 * 1024))} MB (recibido: ${command.contentLength} bytes).`,
      );
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const rental = await this.rentals.findById(command.rentalId, scope);
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (rental.status !== 'PENDING_DELIVERY') {
      throw new RentalStateConflictError('subir evidencia de entrega en', rental.status);
    }

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      rentalId: command.rentalId,
      type: command.type,
      zone: command.zone,
      contentType: command.contentType,
    });
  }
}
