import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProbationAlertService } from './probation-alert.service';
import { limaDateStartToUtc } from '../../../../common/time/lima-time';

describe('ProbationAlertService', () => {
  let prisma: any;
  let outbox: any;
  let clock: any;
  let service: ProbationAlertService;

  beforeEach(() => {
    prisma = {
      employeeOnboarding: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    outbox = {
      publish: jest.fn(),
    };
    clock = {
      now: jest.fn(),
    };
    service = new ProbationAlertService(prisma, outbox, clock);
  });

  it('no crea alertas si faltan más de 15 días para los 3 meses', async () => {
    // Ingreso: 2026-08-01 -> fin de prueba: 2026-11-01
    // Fecha actual: 2026-10-01 (faltan 31 días)
    clock.now.mockReturnValue(limaDateStartToUtc('2026-10-01'));

    prisma.employeeOnboarding.findMany.mockResolvedValue([
      {
        id: 'onb-1',
        candidateId: 'cand-1',
        startDate: new Date('2026-08-01T00:00:00Z'),
        isCompleted: true,
        probationPassed: null,
        probationAlertSentAt: null,
        candidate: {
          fullName: 'Juan Pérez',
          vacancyId: 'vac-1',
          vacancy: {
            organizationId: 'org-1',
            operatingCompanyId: 'comp-1',
            branchId: 'branch-1',
          },
        },
      },
    ]);

    const result = await service.run();
    expect(result.candidatesChecked).toBe(1);
    expect(result.alertsCreated).toBe(0);
    expect(prisma.employeeOnboarding.update).not.toHaveBeenCalled();
    expect(outbox.publish).not.toHaveBeenCalled();
  });

  it('crea alerta e idempotencia (marca probationAlertSentAt) cuando faltan 15 días o menos', async () => {
    // Ingreso: 2026-08-01 -> fin de prueba: 2026-11-01
    // Fecha actual: 2026-10-20 (faltan 12 días)
    const now = limaDateStartToUtc('2026-10-20');
    clock.now.mockReturnValue(now);

    prisma.employeeOnboarding.findMany.mockResolvedValue([
      {
        id: 'onb-1',
        candidateId: 'cand-1',
        startDate: new Date('2026-08-01T00:00:00Z'),
        isCompleted: true,
        probationPassed: null,
        probationAlertSentAt: null,
        candidate: {
          fullName: 'Juan Pérez',
          vacancyId: 'vac-1',
          vacancy: {
            organizationId: 'org-1',
            operatingCompanyId: 'comp-1',
            branchId: 'branch-1',
          },
        },
      },
    ]);

    const result = await service.run();
    expect(result.candidatesChecked).toBe(1);
    expect(result.alertsCreated).toBe(1);

    expect(prisma.employeeOnboarding.update).toHaveBeenCalledWith({
      where: { id: 'onb-1' },
      data: { probationAlertSentAt: now },
    });

    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'EmployeeOnboarding',
        aggregateId: 'onb-1',
        eventType: 'FinPeriodoPruebaProximo.v1',
        payload: expect.objectContaining({
          onboardingId: 'onb-1',
          candidateId: 'cand-1',
          fullName: 'Juan Pérez',
          daysLeft: 12,
          organizationId: 'org-1',
          operatingCompanyId: 'comp-1',
          branchId: 'branch-1',
        }),
      }),
      expect.anything(),
    );
  });
});
