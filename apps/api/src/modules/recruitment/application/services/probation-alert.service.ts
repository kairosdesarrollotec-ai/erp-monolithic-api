import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { calculateProbationDaysRemaining, isProbationEndingSoon } from '../../domain/probation-period';
import { calendarDateToString } from '../../../../common/time/lima-time';

export interface ProbationAlertRunSummary {
  candidatesChecked: number;
  alertsCreated: number;
}

/**
 * HU-33 / BR-REC-005 - Servicio para emitir la alerta de fin de periodo de prueba.
 * Notifica a Gerencia General 15 días antes de vencer los 3 meses del periodo de prueba.
 * Es idempotente: marca `probationAlertSentAt` en `employee_onboardings` y emite el evento
 * transversal `FinPeriodoPruebaProximo.v1`.
 */
@Injectable()
export class ProbationAlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxEventRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async run(): Promise<ProbationAlertRunSummary> {
    const now = this.clock.now();

    const candidatesInProbation = await this.prisma.employeeOnboarding.findMany({
      where: {
        isCompleted: true,
        probationPassed: null,
        probationAlertSentAt: null,
      },
      include: {
        candidate: {
          include: {
            vacancy: true,
          },
        },
      },
    });

    let alertsCreated = 0;

    for (const onboarding of candidatesInProbation) {
      if (!isProbationEndingSoon(onboarding.startDate, now)) {
        continue;
      }

      const daysLeft = calculateProbationDaysRemaining(onboarding.startDate, now);
      const candidate = onboarding.candidate;
      const vacancy = candidate.vacancy;

      await this.prisma.$transaction(async (tx) => {
        await tx.employeeOnboarding.update({
          where: { id: onboarding.id },
          data: { probationAlertSentAt: now },
        });

        await this.outbox.publish(
          {
            aggregateType: 'EmployeeOnboarding',
            aggregateId: onboarding.id,
            eventType: 'FinPeriodoPruebaProximo.v1',
            payload: {
              onboardingId: onboarding.id,
              candidateId: onboarding.candidateId,
              vacancyId: candidate.vacancyId,
              fullName: candidate.fullName,
              startDate: calendarDateToString(onboarding.startDate),
              daysLeft,
              organizationId: vacancy.organizationId,
              operatingCompanyId: vacancy.operatingCompanyId,
              branchId: vacancy.branchId,
            },
          },
          tx,
        );
      });

      alertsCreated++;
    }

    return {
      candidatesChecked: candidatesInProbation.length,
      alertsCreated,
    };
  }
}
