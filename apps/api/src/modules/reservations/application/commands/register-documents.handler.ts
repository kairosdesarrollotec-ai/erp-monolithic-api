import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { RegisterDocumentsCommand } from './register-documents.command';

/**
 * RES-P10 - solo marca documents_completed_at. Nunca crea un
 * vehicle_commitment por si solo (BR-RES-009, DR-RES-002).
 */
@Injectable()
export class RegisterDocumentsHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly workContext: WorkContextRepositoryPort,
  ) {}

  async execute(command: RegisterDocumentsCommand): Promise<ReservationRecord> {
    const assignment = await this.workContext.findValidAssignment({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion de empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    const existing = await this.reservations.findById(command.id, assignment.organizationId);
    if (!existing) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    return this.reservations.registerDocuments(command.id, assignment.organizationId, command.expectedVersion);
  }
}
