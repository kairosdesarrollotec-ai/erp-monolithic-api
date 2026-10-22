import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VacancySource } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  OutboxEventConsumer,
  OutboxEventConsumerRegistry,
  OutboxEventEnvelope,
} from '../../../outbox/application/outbox-event-consumer.registry';
import { normalizeChannelText } from '../../domain/recruitment-rules';
import { VacancyAreaCatalogPort } from '../ports/vacancy-area-catalog.port';
import { VacancyRecord, VacancyRepositoryPort } from '../ports/vacancy-repository.port';

export const RELACION_LABORAL_TERMINADA_EVENT = 'RelacionLaboralTerminada.v1';
export const VACANTE_CREADA_EVENT = 'VacanteCreada.v1';

/** Payload comun de RelacionLaboralTerminada.v1 (Personal: HR_TERMINATION; Reclutamiento: PROBATION_NEGATIVE). */
export interface RelacionLaboralTerminadaEvent {
  source?: 'HR_TERMINATION' | 'PROBATION_NEGATIVE';
  candidateId?: string | null;
  vacancyId?: string | null;
  employeeId?: string | null;
  terminationId?: string | null;
  reason?: string;
  areaName?: string | null;
  jobTitle?: string | null;
  terminatedAt?: string;
  actorUserId?: string;
  organizationId?: string;
  operatingCompanyId?: string;
  branchId?: string;
}

export interface CreateVacancyFromTerminationResult {
  vacancy: VacancyRecord;
  created: boolean;
}

/**
 * Respuestas 2026-10-22 #5 (Russbel): la terminacion laboral crea AUTOMATICAMENTE la vacante en Reclutamiento (estado
 * NECESIDAD_REGISTRADA), tambien cuando la terminacion es por prueba negativa. `source` = RENUNCIA, el origen existente «renuncia/salida»,
 * tanto para renuncia como para despido y prueba negativa. El area y el cargo salen de la ficha del colaborador (payload del evento,
 * resuelto contra el catalogo hr_areas cuando coincide); en la prueba negativa no hay ficha y se copian de la vacante original.
 *
 * IDEMPOTENTE (el relay reintenta ante cualquier fallo): un evento -> una vacante (`origin_event_id` UNIQUE) y un candidato -> una
 * vacante (`origin_candidate_id` UNIQUE), de modo que prueba negativa + baja de la ficha no duplican. Emite `VacanteCreada.v1`
 * en la misma transaccion (el aviso a Gerencia lo proyecta el relay segun NOTIFICATIONS.RECEIVE_HR_ALERTS).
 */
@Injectable()
export class VacancyFromTerminationConsumer implements OutboxEventConsumer, OnModuleInit {
  readonly name = 'recruitment.vacancy-from-termination';
  readonly eventTypes = [RELACION_LABORAL_TERMINADA_EVENT] as const;
  private readonly logger = new Logger(VacancyFromTerminationConsumer.name);

  constructor(
    private readonly registry: OutboxEventConsumerRegistry,
    private readonly vacancies: VacancyRepositoryPort,
    private readonly areaCatalog: VacancyAreaCatalogPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventEnvelope): Promise<void> {
    await this.createFromTermination(event);
  }

  async createFromTermination(event: OutboxEventEnvelope): Promise<CreateVacancyFromTerminationResult | null> {
    const payload = (event.payload ?? {}) as RelacionLaboralTerminadaEvent;
    const { organizationId, operatingCompanyId, branchId } = payload;
    if (!organizationId || !operatingCompanyId || !branchId) {
      // Evento mal formado: reintentar no lo arregla. Se registra y se descarta (el relay lo marca procesado).
      this.logger.error(`Evento ${event.id} (${event.eventType}) sin alcance de empresa/sede: no se crea vacante.`);
      return null;
    }
    const scope = { organizationId, operatingCompanyId, branchId };

    return this.transactionManager.run(async (tx) => {
      // Idempotencia: este evento o este candidato ya originaron su vacante de reemplazo.
      const byEvent = await this.vacancies.findByOriginEventId(event.id, tx);
      if (byEvent) return { vacancy: byEvent, created: false };
      if (payload.candidateId) {
        const byCandidate = await this.vacancies.findByOriginCandidateId(payload.candidateId, tx);
        if (byCandidate) return { vacancy: byCandidate, created: false };
      }

      const template = await this.resolveTemplate(payload, scope, tx);
      const code = await this.vacancies.generateNextCode(operatingCompanyId, tx);
      const createdBy = payload.actorUserId || 'system';

      const vacancy = await this.vacancies.create(
        {
          organizationId,
          operatingCompanyId,
          branchId,
          code,
          title: template.title,
          department: template.department,
          source: VacancySource.RENUNCIA,
          isMechanic: template.isMechanic,
          createdBy,
          originEventId: event.id,
          originTerminationId: payload.terminationId ?? null,
          originEmployeeId: payload.employeeId ?? null,
          originCandidateId: payload.candidateId ?? null,
        },
        tx,
      );

      await this.auditRepository.recordRecruitmentEvent(
        {
          organizationId,
          actorUserId: createdBy,
          entityType: 'vacancy',
          entityId: vacancy.id,
          action: 'VACANCY_REGISTERED',
          changes: {
            code: vacancy.code,
            title: vacancy.title,
            department: vacancy.department,
            source: vacancy.source,
            isMechanic: vacancy.isMechanic,
            origin: payload.source ?? 'HR_TERMINATION',
            originEventId: event.id,
            originTerminationId: payload.terminationId ?? null,
            originEmployeeId: payload.employeeId ?? null,
            terminationReason: payload.reason ?? null,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'Vacancy',
          aggregateId: vacancy.id,
          eventType: VACANTE_CREADA_EVENT,
          payload: {
            vacancyId: vacancy.id,
            code: vacancy.code,
            title: vacancy.title,
            department: vacancy.department,
            source: vacancy.source,
            originEventId: event.id,
            originTerminationId: payload.terminationId ?? null,
            originEmployeeId: payload.employeeId ?? null,
            terminationReason: payload.reason ?? null,
            actorUserId: createdBy,
            organizationId,
            operatingCompanyId,
            branchId,
          },
        },
        tx,
      );

      return { vacancy, created: true };
    });
  }

  /** Cargo, area y tipo de la vacante de reemplazo: de la ficha (HR) o de la vacante original (prueba negativa). */
  private async resolveTemplate(
    payload: RelacionLaboralTerminadaEvent,
    scope: { organizationId: string; operatingCompanyId: string; branchId: string },
    tx: Parameters<VacancyRepositoryPort['findById']>[2],
  ): Promise<{ title: string; department: string; isMechanic: boolean }> {
    if (payload.source === 'PROBATION_NEGATIVE' || !payload.employeeId) {
      const original = payload.vacancyId ? await this.vacancies.findById(payload.vacancyId, scope, tx) : null;
      if (!original) {
        throw new Error(`No se encontro la vacante original ${payload.vacancyId ?? '(sin id)'} de la prueba negativa para crear el reemplazo.`);
      }
      return { title: original.title, department: original.department, isMechanic: original.isMechanic };
    }

    const title = (payload.jobTitle ?? '').trim().slice(0, 150) || 'Reemplazo de personal';
    const areaText = (payload.areaName ?? '').trim();
    const area = areaText ? await this.areaCatalog.resolveActive(scope.operatingCompanyId, areaText) : null;
    const department = (area?.name ?? areaText).slice(0, 100) || 'Sin área';
    return { title, department, isMechanic: normalizeChannelText(title).includes('mecanic') };
  }
}
