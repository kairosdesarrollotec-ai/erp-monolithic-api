import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RentalEvidenceRecord, RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { RecordEvidenceCommand } from './record-evidence.command';

/**
 * ALQ-09 / BR-INS-003 / BR-INS-004 - registra en BD la evidencia que el
 * cliente ya subio directamente a GCS con la URL firmada obtenida de
 * RequestEvidenceUploadSessionHandler (mismo patron de 2 pasos que Fleet:
 * pedir sesion firmada -> subir a GCS -> confirmar). Aqui la confirmacion
 * si persiste un registro (a diferencia de Fleet, donde el objectUrl se
 * guarda directo en el vehiculo) porque complete-delivery necesita contar
 * evidencias reales (BR-INS-003/004).
 */
@Injectable()
export class RecordEvidenceHandler {
  constructor(
    private readonly evidence: RentalEvidenceRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: RecordEvidenceCommand): Promise<RentalEvidenceRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'UPLOAD_EVIDENCE', { companyId: context.companyId, branchId: context.branchId });

    if (!command.objectUrl.startsWith('https://storage.googleapis.com/')) {
      throw new BadRequestException('objectUrl debe ser una URL de GCS valida (obtenida de upload-url).');
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
      throw new RentalStateConflictError('registrar evidencia de entrega en', rental.status);
    }

    return this.evidence.record({
      rentalId: command.rentalId,
      scope,
      type: command.type,
      zone: command.zone,
      objectUrl: command.objectUrl,
      uploadedBy: command.firebaseUid,
    });
  }
}
