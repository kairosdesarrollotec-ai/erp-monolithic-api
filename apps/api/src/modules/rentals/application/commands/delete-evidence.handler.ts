import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { DeleteEvidenceCommand } from './delete-evidence.command';

/**
 * ALQ-09 - elimina una evidencia (foto/video) registrada por error durante
 * el checklist de entrega. Solo mientras el alquiler siga en
 * PENDING_DELIVERY: una vez completada la entrega la evidencia es el
 * respaldo del estado del vehiculo y no se puede alterar. Misma accion de
 * matriz que subirla (UPLOAD_EVIDENCE). Se borra el registro; el archivo
 * en el bucket no se toca (queda huerfano, sin referencia).
 */
@Injectable()
export class DeleteEvidenceHandler {
  constructor(
    private readonly evidence: RentalEvidenceRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: DeleteEvidenceCommand): Promise<void> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'UPLOAD_EVIDENCE', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

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
      throw new RentalStateConflictError('eliminar evidencia de entrega en', rental.status);
    }

    const removed = await this.evidence.delete(command.rentalId, command.evidenceId, scope);
    if (!removed) {
      throw new NotFoundException('Evidencia no encontrada.');
    }
  }
}
