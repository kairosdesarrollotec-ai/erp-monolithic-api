import { Injectable } from '@nestjs/common';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnEvidenceRemovalService } from '../services/return-evidence-removal.service';
import { DeleteReturnEvidenceCommand } from './delete-return-evidence.command';

/**
 * DEV-04 - borrado DIRECTO de una evidencia de recepcion (DEC-EVID-DELETE-001). DEPRECADO desde DEC-EVID-DELETE-002
 * (Respuestas 2026-10-20 #35): eliminar evidencia exige doble aprobacion (POST /evidence/deletion-requests); este atajo queda
 * detras de EVIDENCE.DELETE_DIRECT, que la v0 de la matriz solo concede a PLATFORM_ADMIN. La regla de estado y el borrado viven
 * en ReturnEvidenceRemovalService (compartidos con la ejecucion de la solicitud aprobada).
 */
@Injectable()
export class DeleteReturnEvidenceHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly removal: ReturnEvidenceRemovalService,
  ) {}

  async execute(command: DeleteReturnEvidenceCommand): Promise<void> {
    const { scope } = await this.access.authorizeEvidence(command, 'DELETE_DIRECT');
    await this.removal.remove(command.returnId, command.evidenceId, scope);
  }
}
