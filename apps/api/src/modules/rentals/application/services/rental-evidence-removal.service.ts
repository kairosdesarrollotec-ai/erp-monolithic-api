import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RentalEvidenceRecord, RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { RentalRepositoryPort, RentalScope } from '../ports/rental-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';

/**
 * Unica logica de «se puede eliminar esta evidencia de entrega y como»: solo mientras el alquiler siga en PENDING_DELIVERY
 * (despues la evidencia es el respaldo del estado del vehiculo, DEC-EVID-DELETE-001). La reutilizan el borrado directo
 * (DEPRECADO, EVIDENCE.DELETE_DIRECT) y la ejecucion de la solicitud con doble aprobacion (DEC-EVID-DELETE-002); ninguno de los
 * dos duplica la regla. No autoriza: quien llama ya valido el permiso.
 */
@Injectable()
export class RentalEvidenceRemovalService {
  constructor(
    private readonly evidence: RentalEvidenceRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
  ) {}

  /** Verifica alquiler, estado y existencia de la evidencia; devuelve el registro (para la foto fija de la solicitud). */
  async locate(rentalId: string, evidenceId: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<RentalEvidenceRecord> {
    const rental = await this.rentals.findById(rentalId, scope, tx);
    if (!rental) throw new NotFoundException('Alquiler no encontrado.');
    if (rental.status !== 'PENDING_DELIVERY') {
      throw new RentalStateConflictError('eliminar evidencia de entrega en', rental.status);
    }
    const found = (await this.evidence.list(rentalId, scope)).find((item) => item.id === evidenceId);
    if (!found) throw new NotFoundException('Evidencia no encontrada.');
    return found;
  }

  /** Borra el registro (el archivo del bucket queda huerfano, sin referencia). */
  async remove(rentalId: string, evidenceId: string, scope: RentalScope, tx?: Prisma.TransactionClient): Promise<void> {
    const rental = await this.rentals.findById(rentalId, scope, tx);
    if (!rental) throw new NotFoundException('Alquiler no encontrado.');
    if (rental.status !== 'PENDING_DELIVERY') {
      throw new RentalStateConflictError('eliminar evidencia de entrega en', rental.status);
    }
    const removed = await this.evidence.delete(rentalId, evidenceId, scope, tx);
    if (!removed) throw new NotFoundException('Evidencia no encontrada.');
  }
}
