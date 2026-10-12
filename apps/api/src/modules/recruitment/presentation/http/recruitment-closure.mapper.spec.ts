import { toOnboardingResponse } from './recruitment.mapper';
import type { OnboardingRecord } from '../../application/ports/onboarding-repository.port';

function record(over: Partial<OnboardingRecord> = {}): OnboardingRecord {
  return {
    id: 'onb-1',
    candidateId: 'cand-1',
    startDate: new Date('2026-09-08T00:00:00Z'),
    inductionScheduled: true,
    equipmentAssigned: true,
    responsibilityCardSigned: true,
    notarizedContractSigned: true,
    isCompleted: true,
    completedAt: new Date('2026-09-08T12:00:00Z'),
    probationPassed: null,
    probationEvaluation: null,
    probationEvaluatedAt: null,
    probationEvaluatedBy: null,
    probationMonthlyFee: 3350,
    postProbationMonthlySalary: 3500,
    probationFeeNotes: 'Guardias S/ 80',
    probationFeesRecordedAt: new Date('2026-09-09T10:00:00Z'),
    probationFeesRecordedBy: 'uid-1',
    feesVisible: true,
    version: 2,
    completedBy: 'uid-1',
    createdAt: new Date('2026-09-08T12:00:00Z'),
    ...over,
  };
}

describe('toOnboardingResponse - honorarios (default-deny)', () => {
  it('emite los honorarios solo cuando la vista esta autorizada', () => {
    const response = toOnboardingResponse(record());
    expect(response.probationMonthlyFee).toBe(3350);
    expect(response.postProbationMonthlySalary).toBe(3500);
    expect(response.probationFeeNotes).toBe('Guardias S/ 80');
    expect(response.probationFeesRecordedAt).toBe('2026-09-09T10:00:00.000Z');
    expect(response.feesRestricted).toBe(false);
    expect(response.version).toBe(2);
  });

  it('aunque el registro traiga montos, sin feesVisible NO se exponen (defensa en profundidad)', () => {
    const response = toOnboardingResponse(record({ feesVisible: false }));
    expect(response.probationMonthlyFee).toBeNull();
    expect(response.postProbationMonthlySalary).toBeNull();
    expect(response.probationFeeNotes).toBeNull();
    expect(response.probationFeesRecordedAt).toBeNull();
    expect(response.feesRestricted).toBe(true);
  });
});
