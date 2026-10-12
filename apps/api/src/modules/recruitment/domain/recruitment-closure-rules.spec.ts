import { NegotiationOutcome, VacancyStatus } from '@prisma/client';
import {
  applyOnboardingFeeVisibility,
  assertCandidateCvFile,
  assertNegotiationValid,
  assertValidVacancyTransition,
  assertVacancyPausable,
  assertVacancyResumable,
  CANDIDATE_CV_MAX_BYTES,
  maskCandidateSensitiveFields,
  sanitizeCvFileName,
} from './recruitment-rules';
import {
  CandidateCvInvalidFileError,
  NegotiationInvalidError,
  VacancyNotPausableError,
  VacancyNotTransitionableError,
} from './recruitment-errors';

describe('recruitment-rules (cierre de huecos)', () => {
  describe('pausar / reanudar', () => {
    it('PUBLICADA <-> PAUSADA y PAUSADA puede cancelarse', () => {
      expect(() => assertValidVacancyTransition(VacancyStatus.PUBLICADA, VacancyStatus.PAUSADA)).not.toThrow();
      expect(() => assertValidVacancyTransition(VacancyStatus.PAUSADA, VacancyStatus.PUBLICADA)).not.toThrow();
      expect(() => assertValidVacancyTransition(VacancyStatus.PAUSADA, VacancyStatus.CANCELADA)).not.toThrow();
    });

    it('no se puede saltar de PAUSADA a DECIDIDA ni pausar una necesidad sin publicar', () => {
      expect(() => assertValidVacancyTransition(VacancyStatus.PAUSADA, VacancyStatus.DECIDIDA)).toThrow(
        VacancyNotTransitionableError,
      );
      expect(() => assertValidVacancyTransition(VacancyStatus.NECESIDAD_REGISTRADA, VacancyStatus.PAUSADA)).toThrow(
        VacancyNotTransitionableError,
      );
    });

    it('solo se pausa PUBLICADA y solo se reanuda PAUSADA', () => {
      expect(() => assertVacancyPausable(VacancyStatus.PUBLICADA)).not.toThrow();
      expect(() => assertVacancyPausable(VacancyStatus.PAUSADA)).toThrow(VacancyNotPausableError);
      expect(() => assertVacancyResumable(VacancyStatus.PAUSADA)).not.toThrow();
      expect(() => assertVacancyResumable(VacancyStatus.PUBLICADA)).toThrow(VacancyNotPausableError);
    });
  });

  describe('assertCandidateCvFile (DAT-REC-004)', () => {
    it.each([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ])('acepta %s', (type) => {
      expect(() => assertCandidateCvFile(type, 1024)).not.toThrow();
    });

    it('acepta exactamente el tope y rechaza un byte mas', () => {
      expect(() => assertCandidateCvFile('application/pdf', CANDIDATE_CV_MAX_BYTES)).not.toThrow();
      expect(() => assertCandidateCvFile('application/pdf', CANDIDATE_CV_MAX_BYTES + 1)).toThrow(CandidateCvInvalidFileError);
    });

    it.each(['text/html', 'application/zip', 'video/mp4', 'application/msword', ''])('rechaza %p', (type) => {
      expect(() => assertCandidateCvFile(type, 1024)).toThrow(CandidateCvInvalidFileError);
    });

    it.each([0, -1, 1.5, Number.NaN])('rechaza tamano invalido %p', (size) => {
      expect(() => assertCandidateCvFile('application/pdf', size)).toThrow(CandidateCvInvalidFileError);
    });
  });

  describe('sanitizeCvFileName', () => {
    it('quita rutas y caracteres de control, y acota a 200', () => {
      expect(sanitizeCvFileName('C:\\Users\\ana\\CV.pdf')).toBe('CV.pdf');
      expect(sanitizeCvFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeCvFileName('CV\u0000\nAna.pdf')).toBe('CVAna.pdf');
      expect(sanitizeCvFileName('x'.repeat(300))).toHaveLength(200);
      expect(sanitizeCvFileName('   ')).toBe('cv');
    });
  });

  describe('assertNegotiationValid (REC-04)', () => {
    const base = { outcome: NegotiationOutcome.EN_CURSO, offeredSalary: 3200 };

    it('EN_CURSO solo necesita el sueldo ofrecido', () => {
      expect(() => assertNegotiationValid(base)).not.toThrow();
    });

    it('ACORDADA exige sueldo acordado; en otro resultado no se admite', () => {
      expect(() => assertNegotiationValid({ ...base, outcome: NegotiationOutcome.ACORDADA })).toThrow(NegotiationInvalidError);
      expect(() =>
        assertNegotiationValid({ ...base, outcome: NegotiationOutcome.ACORDADA, agreedSalary: 3350 }),
      ).not.toThrow();
      expect(() => assertNegotiationValid({ ...base, agreedSalary: 3350 })).toThrow(NegotiationInvalidError);
    });

    it('NO_ACORDADA exige motivo no vacio', () => {
      expect(() => assertNegotiationValid({ ...base, outcome: NegotiationOutcome.NO_ACORDADA })).toThrow(NegotiationInvalidError);
      expect(() =>
        assertNegotiationValid({ ...base, outcome: NegotiationOutcome.NO_ACORDADA, reason: ' ' }),
      ).toThrow(NegotiationInvalidError);
      expect(() =>
        assertNegotiationValid({ ...base, outcome: NegotiationOutcome.NO_ACORDADA, reason: 'No acepta el horario' }),
      ).not.toThrow();
    });

    it('rechaza montos negativos o no finitos', () => {
      expect(() => assertNegotiationValid({ ...base, offeredSalary: -1 })).toThrow(NegotiationInvalidError);
      expect(() => assertNegotiationValid({ ...base, candidateSalary: Number.POSITIVE_INFINITY })).toThrow(NegotiationInvalidError);
    });
  });

  describe('visibilidad de datos financieros y sensibles', () => {
    const onboarding = {
      probationMonthlyFee: 3350,
      postProbationMonthlySalary: 3500,
      probationFeeNotes: 'Guardias',
      probationFeesRecordedAt: new Date('2026-10-07T12:00:00Z'),
      probationFeesRecordedBy: 'uid-1',
      feesVisible: false,
      version: 2,
    };

    it('applyOnboardingFeeVisibility anula los honorarios sin permiso y marca la vista como restringida', () => {
      const hidden = applyOnboardingFeeVisibility(onboarding, false);
      expect(hidden).toMatchObject({
        probationMonthlyFee: null,
        postProbationMonthlySalary: null,
        probationFeeNotes: null,
        probationFeesRecordedAt: null,
        probationFeesRecordedBy: null,
        feesVisible: false,
        version: 2,
      });
    });

    it('applyOnboardingFeeVisibility conserva los honorarios con permiso', () => {
      const visible = applyOnboardingFeeVisibility(onboarding, true);
      expect(visible.probationMonthlyFee).toBe(3350);
      expect(visible.feesVisible).toBe(true);
    });

    it('maskCandidateSensitiveFields oculta CV, negociacion y honorarios, pero conserva hasCv', () => {
      const candidate = {
        email: 'a@b.pe',
        phone: '9',
        cvDocumentId: 'doc',
        cv: { fileName: 'cv.pdf' },
        hasCv: true,
        negotiations: [{ id: 'n1' }],
        onboarding,
        salaryExpectation: 3500,
      };
      const masked = maskCandidateSensitiveFields(candidate, false);
      expect(masked.cv).toBeNull();
      expect(masked.negotiations).toEqual([]);
      expect(masked.hasCv).toBe(true);
      expect((masked.onboarding as typeof onboarding).probationMonthlyFee).toBeNull();
      expect((masked.onboarding as typeof onboarding).feesVisible).toBe(false);

      const visible = maskCandidateSensitiveFields(candidate, true);
      expect(visible.cv).toEqual({ fileName: 'cv.pdf' });
      expect(visible.negotiations).toHaveLength(1);
      expect((visible.onboarding as typeof onboarding).probationMonthlyFee).toBe(3350);
      expect((visible.onboarding as typeof onboarding).feesVisible).toBe(true);
    });
  });
});
