import {
  CandidateDecision,
  CandidateProcessState as PS,
  VacancyStatus as VS,
} from './recruitment-domain-types';
import { CandidateStateTransitionError, VacancyNotTransitionableError } from './recruitment-errors';
import {
  assertCandidateProcessTransition,
  assertValidVacancyTransition,
  canTransitionCandidateProcess,
  resolveDecisionProcessState,
  resolveVacancyProgress,
} from './recruitment-rules';

/** BDD-REC-001 §11.6, columna "Salidas permitidas" (Planilla -> Terminado es "(futuro)": no se habilita). */
const DOCUMENTED: Array<[PS, PS]> = [
  [PS.EN_NEGOCIACION, PS.ENTREVISTADO],
  [PS.EN_NEGOCIACION, PS.DESCARTADO],
  [PS.ENTREVISTADO, PS.DECIDIDO],
  [PS.DECIDIDO, PS.INGRESADO],
  [PS.DECIDIDO, PS.DESCARTADO],
  [PS.INGRESADO, PS.PERIODO_PRUEBA],
  [PS.PERIODO_PRUEBA, PS.PLANILLA],
  [PS.PERIODO_PRUEBA, PS.TERMINADO],
];

describe('BDD-REC §11.6 - estado de proceso del candidato', () => {
  const all = Object.values(PS);

  it('permite exactamente las 8 transiciones documentadas y ninguna otra', () => {
    const allowed: Array<[PS, PS]> = [];
    for (const from of all) {
      for (const to of all) {
        if (canTransitionCandidateProcess(from, to)) allowed.push([from, to]);
      }
    }
    expect(allowed.sort()).toEqual([...DOCUMENTED].sort());
  });

  it('lanza CANDIDATE_STATE_TRANSITION_INVALID al saltarse o retroceder estados', () => {
    expect(() => assertCandidateProcessTransition(PS.EN_NEGOCIACION, PS.DECIDIDO)).toThrow(CandidateStateTransitionError);
    expect(() => assertCandidateProcessTransition(PS.ENTREVISTADO, PS.EN_NEGOCIACION)).toThrow(CandidateStateTransitionError);
    expect(() => assertCandidateProcessTransition(PS.DECIDIDO, PS.PERIODO_PRUEBA)).toThrow(CandidateStateTransitionError);
    expect(() => assertCandidateProcessTransition(PS.PLANILLA, PS.TERMINADO)).toThrow(CandidateStateTransitionError);
    expect(() => assertCandidateProcessTransition(PS.PLANILLA, PS.PLANILLA)).toThrow(CandidateStateTransitionError);
    try {
      assertCandidateProcessTransition(PS.DESCARTADO, PS.ENTREVISTADO);
    } catch (e) {
      expect((e as CandidateStateTransitionError).code).toBe('CANDIDATE_STATE_TRANSITION_INVALID');
    }
  });

  it('DESCARTADO, PLANILLA y TERMINADO no tienen salidas', () => {
    for (const terminal of [PS.DESCARTADO, PS.PLANILLA, PS.TERMINADO]) {
      expect(all.filter((to) => canTransitionCandidateProcess(terminal, to))).toEqual([]);
    }
  });

  describe('resolveDecisionProcessState', () => {
    it('CONTRATADO solo desde ENTREVISTADO (Decidido: entrada únicamente desde Entrevistado)', () => {
      expect(resolveDecisionProcessState(PS.ENTREVISTADO, CandidateDecision.CONTRATADO)).toBe(PS.DECIDIDO);
      expect(() => resolveDecisionProcessState(PS.EN_NEGOCIACION, CandidateDecision.CONTRATADO)).toThrow(
        CandidateStateTransitionError,
      );
    });

    it('RECHAZADO descarta desde EN_NEGOCIACION o, tras la entrevista, pasando por DECIDIDO', () => {
      expect(resolveDecisionProcessState(PS.EN_NEGOCIACION, CandidateDecision.RECHAZADO)).toBe(PS.DESCARTADO);
      expect(resolveDecisionProcessState(PS.ENTREVISTADO, CandidateDecision.RECHAZADO)).toBe(PS.DESCARTADO);
    });

    it.each([PS.INGRESADO, PS.PERIODO_PRUEBA, PS.PLANILLA, PS.TERMINADO, PS.DESCARTADO])(
      'no se decide sobre un candidato en %s',
      (state) => {
        expect(() => resolveDecisionProcessState(state, CandidateDecision.RECHAZADO)).toThrow(CandidateStateTransitionError);
        expect(() => resolveDecisionProcessState(state, CandidateDecision.CONTRATADO)).toThrow(CandidateStateTransitionError);
      },
    );

    it('desde DECIDIDO solo cabe descartar (nunca volver a contratar)', () => {
      expect(resolveDecisionProcessState(PS.DECIDIDO, CandidateDecision.RECHAZADO)).toBe(PS.DESCARTADO);
      expect(() => resolveDecisionProcessState(PS.DECIDIDO, CandidateDecision.CONTRATADO)).toThrow(CandidateStateTransitionError);
    });
  });
});

describe('BDD-REC §11.6 - estado de la vacante', () => {
  it('encadena Necesidad -> Publicado -> En negociación -> Entrevistado -> Decidido', () => {
    expect(() => assertValidVacancyTransition(VS.NECESIDAD_REGISTRADA, VS.PUBLICADA)).not.toThrow();
    expect(() => assertValidVacancyTransition(VS.PUBLICADA, VS.EN_NEGOCIACION)).not.toThrow();
    expect(() => assertValidVacancyTransition(VS.EN_NEGOCIACION, VS.ENTREVISTADA)).not.toThrow();
    expect(() => assertValidVacancyTransition(VS.ENTREVISTADA, VS.DECIDIDA)).not.toThrow();
  });

  it('Decidido solo entra desde Entrevistado', () => {
    expect(() => assertValidVacancyTransition(VS.PUBLICADA, VS.DECIDIDA)).toThrow(VacancyNotTransitionableError);
    expect(() => assertValidVacancyTransition(VS.EN_NEGOCIACION, VS.DECIDIDA)).toThrow(VacancyNotTransitionableError);
  });

  describe('resolveVacancyProgress (avance automático, monótono)', () => {
    it('avanza hacia adelante', () => {
      expect(resolveVacancyProgress(VS.PUBLICADA, VS.EN_NEGOCIACION)).toBe(VS.EN_NEGOCIACION);
      expect(resolveVacancyProgress(VS.EN_NEGOCIACION, VS.ENTREVISTADA)).toBe(VS.ENTREVISTADA);
      expect(resolveVacancyProgress(VS.ENTREVISTADA, VS.DECIDIDA)).toBe(VS.DECIDIDA);
    });

    it('nunca retrocede ni repite (un candidato descartado no reabre la vacante, EX-REC-001)', () => {
      expect(resolveVacancyProgress(VS.ENTREVISTADA, VS.EN_NEGOCIACION)).toBeNull();
      expect(resolveVacancyProgress(VS.EN_NEGOCIACION, VS.EN_NEGOCIACION)).toBeNull();
      expect(resolveVacancyProgress(VS.DECIDIDA, VS.ENTREVISTADA)).toBeNull();
    });

    it.each([VS.NECESIDAD_REGISTRADA, VS.PAUSADA, VS.CANCELADA])('no mueve una vacante %s', (status) => {
      expect(resolveVacancyProgress(status, VS.EN_NEGOCIACION)).toBeNull();
      expect(resolveVacancyProgress(status, VS.DECIDIDA)).toBeNull();
    });
  });
});
