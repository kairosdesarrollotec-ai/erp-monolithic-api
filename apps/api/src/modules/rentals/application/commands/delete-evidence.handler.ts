import { Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RentalEvidenceRemovalService } from '../services/rental-evidence-removal.service';
import { DeleteEvidenceCommand } from './delete-evidence.command';

/**
 * ALQ-09 - borrado DIRECTO de una evidencia de entrega (DEC-EVID-DELETE-001). DEPRECADO desde DEC-EVID-DELETE-002
 * (Respuestas 2026-10-20 #35): eliminar evidencia exige doble aprobacion (POST /evidence/deletion-requests); este atajo queda
 * detras de EVIDENCE.DELETE_DIRECT, que la v0 de la matriz solo concede a PLATFORM_ADMIN. La regla (solo en PENDING_DELIVERY) y
 * el borrado viven en RentalEvidenceRemovalService (compartidos con la ejecucion de la solicitud aprobada).
 */
@Injectable()
export class DeleteEvidenceHandler {
  constructor(
    private readonly removal: RentalEvidenceRemovalService,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: DeleteEvidenceCommand): Promise<void> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'EVIDENCE', 'DELETE_DIRECT', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    await this.removal.remove(command.rentalId, command.evidenceId, {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    });
  }
}
