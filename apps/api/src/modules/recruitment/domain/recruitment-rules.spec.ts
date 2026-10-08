import { CandidateDecision, CandidateStage, VacancyStatus } from '@prisma/client';
import {
  assertCandidateNotDecided,
  assertCandidateStageTransition,
  assertMechanicChannels,
  assertOnboardingValid,
  assertValidVacancyTransition,
  maskCandidateSensitiveFields,
} from './recruitment-rules';
import {
  CandidateAlreadyDecidedError,
  MechanicMissingTechnicalChannelsError,
  OnboardingMissingNotarizedContractError,
  VacancyNotTransitionableError,
} from './recruitment-errors';

describe('recruitment-rules', () => {
  describe('assertValidVacancyTransition', () => {
    it('permite transicionar de NECESIDAD_REGISTRADA a PUBLICADA', () => {
      expect(() =>
        assertValidVacancyTransition(VacancyStatus.NECESIDAD_REGISTRADA, VacancyStatus.PUBLICADA),
      ).not.toThrow();
    });

    it('permite transicionar de PUBLICADA a EN_NEGOCIACION o DECIDIDA', () => {
      expect(() =>
        assertValidVacancyTransition(VacancyStatus.PUBLICADA, VacancyStatus.EN_NEGOCIACION),
      ).not.toThrow();
      expect(() =>
        assertValidVacancyTransition(VacancyStatus.PUBLICADA, VacancyStatus.DECIDIDA),
      ).not.toThrow();
    });

    it('lanza VacancyNotTransitionableError si se intenta transicionar desde DECIDIDA', () => {
      expect(() =>
        assertValidVacancyTransition(VacancyStatus.DECIDIDA, VacancyStatus.PUBLICADA),
      ).toThrow(VacancyNotTransitionableError);
    });
  });

  describe('assertMechanicChannels (BR-REC-004)', () => {
    it('no exige canales tecnicos si no es mecanico', () => {
      expect(() => assertMechanicChannels(false, ['Computrabajo', 'LinkedIn'])).not.toThrow();
    });

    it('exige SENATI o TECSUP si es mecanico', () => {
      expect(() =>
        assertMechanicChannels(true, ['Bolsa SENATI', 'LinkedIn']),
      ).not.toThrow();

      expect(() =>
        assertMechanicChannels(true, ['Bolsa de Trabajo TECSUP']),
      ).not.toThrow();

      expect(() =>
        assertMechanicChannels(true, ['LinkedIn', 'Computrabajo']),
      ).toThrow(MechanicMissingTechnicalChannelsError);
    });
  });

  describe('assertCandidateNotDecided (BR-REC-007, SDD 12.1)', () => {
    it('permite decidir si el candidato no tiene decision previa', () => {
      expect(() => assertCandidateNotDecided(null)).not.toThrow();
      expect(() => assertCandidateNotDecided(undefined)).not.toThrow();
    });

    it('lanza CandidateAlreadyDecidedError si ya fue decidido previamente', () => {
      expect(() => assertCandidateNotDecided(CandidateDecision.CONTRATADO)).toThrow(
        CandidateAlreadyDecidedError,
      );
      expect(() => assertCandidateNotDecided(CandidateDecision.RECHAZADO)).toThrow(
        CandidateAlreadyDecidedError,
      );
    });
  });

  describe('assertCandidateStageTransition', () => {
    it('permite avanzar etapas hacia adelante', () => {
      expect(() =>
        assertCandidateStageTransition(CandidateStage.NUEVO, CandidateStage.CONTACTADO),
      ).not.toThrow();
      expect(() =>
        assertCandidateStageTransition(CandidateStage.CONTACTADO, CandidateStage.ENTREVISTA),
      ).not.toThrow();
      expect(() =>
        assertCandidateStageTransition(CandidateStage.ENTREVISTA, CandidateStage.DECISION),
      ).not.toThrow();
    });

    it('rechaza retroceder de etapa', () => {
      expect(() =>
        assertCandidateStageTransition(CandidateStage.DECISION, CandidateStage.ENTREVISTA),
      ).toThrow();
      expect(() =>
        assertCandidateStageTransition(CandidateStage.ENTREVISTA, CandidateStage.NUEVO),
      ).toThrow();
    });
  });

  describe('assertOnboardingValid (BR-REC-009)', () => {
    it('valida que todo el checklist basico este completo', () => {
      expect(() =>
        assertOnboardingValid(false, {
          startDate: new Date(),
          inductionScheduled: false,
          equipmentAssigned: true,
          responsibilityCardSigned: true,
        }),
      ).toThrow();
    });

    it('exige contrato notariado si el puesto es de mecanico', () => {
      expect(() =>
        assertOnboardingValid(true, {
          startDate: new Date(),
          inductionScheduled: true,
          equipmentAssigned: true,
          responsibilityCardSigned: true,
          notarizedContractSigned: false,
        }),
      ).toThrow(OnboardingMissingNotarizedContractError);

      expect(() =>
        assertOnboardingValid(true, {
          startDate: new Date(),
          inductionScheduled: true,
          equipmentAssigned: true,
          responsibilityCardSigned: true,
          notarizedContractSigned: true,
        }),
      ).not.toThrow();
    });
  });

  describe('maskCandidateSensitiveFields (BR-REC-005, PROTO-REC-04)', () => {
    const candidate = {
      id: 'c-1',
      fullName: 'Carlos Ruiz',
      email: 'carlos@example.com',
      phone: '+51999888777',
      cvDocumentId: 'doc-123',
      salaryExpectation: 3500,
    };

    it('enmascara datos sensibles cuando canViewSensitive es false', () => {
      const masked = maskCandidateSensitiveFields(candidate, false);
      expect(masked.isRestrictedView).toBe(true);
      expect(masked.email).toBeNull();
      expect(masked.phone).toBeNull();
      expect(masked.cvDocumentId).toBeNull();
      expect(masked.salaryExpectation).toBeNull();
      expect(masked.fullName).toBe('Carlos Ruiz');
    });

    it('mantiene datos originales cuando canViewSensitive es true', () => {
      const visible = maskCandidateSensitiveFields(candidate, true);
      expect(visible.isRestrictedView).toBe(false);
      expect(visible.email).toBe('carlos@example.com');
      expect(visible.salaryExpectation).toBe(3500);
    });
  });
});
