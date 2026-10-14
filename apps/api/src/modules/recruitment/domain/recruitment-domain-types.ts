// Re-exporta tipos de Prisma como tipos de dominio del módulo Recruitment.
// Mientras Prisma sea la única fuente de persistencia, este patrón evita que
// recruitment-rules.ts importe @prisma/client directamente.
export { CandidateDecision, CandidateStage, NegotiationOutcome, VacancyStatus } from '@prisma/client';
