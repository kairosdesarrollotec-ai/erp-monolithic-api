/**
 * Tipos de dominio propios del módulo Recruitment.
 * Definidos aquí para desacoplar el dominio de @prisma/client.
 * La capa infrastructure mapea desde/hacia los tipos Prisma cuando sea necesario.
 */

export type VacancyStatus =
  | 'NECESIDAD_REGISTRADA'
  | 'PUBLICADA'
  | 'EN_NEGOCIACION'
  | 'ENTREVISTADA'
  | 'PAUSADA'
  | 'DECIDIDA'
  | 'CANCELADA';

export const VacancyStatus = {
  NECESIDAD_REGISTRADA: 'NECESIDAD_REGISTRADA' as const,
  PUBLICADA: 'PUBLICADA' as const,
  EN_NEGOCIACION: 'EN_NEGOCIACION' as const,
  ENTREVISTADA: 'ENTREVISTADA' as const,
  PAUSADA: 'PAUSADA' as const,
  DECIDIDA: 'DECIDIDA' as const,
  CANCELADA: 'CANCELADA' as const,
};

export type CandidateDecision = 'CONTRATADO' | 'RECHAZADO';

export const CandidateDecision = {
  CONTRATADO: 'CONTRATADO' as const,
  RECHAZADO: 'RECHAZADO' as const,
};

export type CandidateStage = 'NUEVO' | 'CONTACTADO' | 'ENTREVISTA' | 'DECISION';

export const CandidateStage = {
  NUEVO: 'NUEVO' as const,
  CONTACTADO: 'CONTACTADO' as const,
  ENTREVISTA: 'ENTREVISTA' as const,
  DECISION: 'DECISION' as const,
};

export type NegotiationOutcome = 'EN_CURSO' | 'ACORDADA' | 'NO_ACORDADA';

export const NegotiationOutcome = {
  EN_CURSO: 'EN_CURSO' as const,
  ACORDADA: 'ACORDADA' as const,
  NO_ACORDADA: 'NO_ACORDADA' as const,
};

/**
 * BDD-REC-001 §11.6 - Estado normativo del candidato en el proceso de Reclutamiento y Selección.
 * (Necesidad registrada y Publicado son estados de la Vacante, ver `VacancyStatus`.)
 */
export type CandidateProcessState =
  | 'EN_NEGOCIACION'
  | 'ENTREVISTADO'
  | 'DECIDIDO'
  | 'DESCARTADO'
  | 'INGRESADO'
  | 'PERIODO_PRUEBA'
  | 'PLANILLA'
  | 'TERMINADO';

export const CandidateProcessState = {
  EN_NEGOCIACION: 'EN_NEGOCIACION' as const,
  ENTREVISTADO: 'ENTREVISTADO' as const,
  DECIDIDO: 'DECIDIDO' as const,
  DESCARTADO: 'DESCARTADO' as const,
  INGRESADO: 'INGRESADO' as const,
  PERIODO_PRUEBA: 'PERIODO_PRUEBA' as const,
  PLANILLA: 'PLANILLA' as const,
  TERMINADO: 'TERMINADO' as const,
};
