import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { TrainingRepositoryPort, TrainingWithAttendees } from '../ports/training-repository.port';
import { InvalidTrainingError, TrainingAttendeesInvalidError } from '../../domain/hr-administration-errors';
import { TRAINING_REFERENCE_MINUTES } from '../../domain/hr-administration-rules';
import { RegisterTrainingCommand } from './register-training.command';

/**
 * ADP-P19 / BR-ADP-008 / DAT-ADP-009: registra un taller interno informal (~1 h) con su tema, asistentes y una nota
 * cualitativa de comprensión. Queda como historial de capacitación de cada asistente. NO es una evaluación formal de
 * desempeño (fuera del MVP, BR-ADP-007): no hay puntajes ni criterios.
 */
@Injectable()
export class RegisterTrainingHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly trainings: TrainingRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RegisterTrainingCommand): Promise<TrainingWithAttendees> {
    const { context, scope } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'REGISTER_TRAINING',
    );

    const topic = command.topic.trim();
    if (topic.length === 0) {
      throw new InvalidTrainingError('Indica el tema del taller.');
    }
    const durationMinutes = command.durationMinutes ?? TRAINING_REFERENCE_MINUTES;
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
      throw new InvalidTrainingError('La duración del taller debe estar entre 1 y 480 minutos.');
    }
    if (command.heldOn.getTime() > this.clock.now().getTime() + 24 * 60 * 60 * 1000) {
      throw new InvalidTrainingError('La fecha del taller no puede ser futura: se registra un taller ya realizado.');
    }
    const attendeeIds = [...new Set(command.attendeeIds)];
    if (attendeeIds.length === 0) {
      throw new TrainingAttendeesInvalidError('Selecciona al menos un asistente.');
    }

    return this.transactionManager.run(async (tx) => {
      const found = await this.employees.findManyByIds(attendeeIds, tx);
      const valid = found.filter((e) => e.operatingCompanyId === scope.operatingCompanyId && e.status !== 'TERMINADO');
      if (valid.length !== attendeeIds.length) {
        throw new TrainingAttendeesInvalidError(
          'Hay asistentes que no pertenecen a esta empresa o ya no tienen relación laboral vigente.',
        );
      }

      const created = await this.trainings.create(
        {
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          branchId: scope.branchId,
          topic,
          heldOn: command.heldOn,
          durationMinutes,
          comprehensionNotes: command.comprehensionNotes?.trim() || null,
          createdById: command.firebaseUid,
          attendeeIds,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'training',
          entityId: created.id,
          action: 'TRAINING_REGISTERED',
          changes: { topic: created.topic, heldOn: created.heldOn, attendees: attendeeIds.length },
        },
        tx,
      );

      return created;
    });
  }
}
