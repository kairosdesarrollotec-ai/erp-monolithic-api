import { IsBoolean } from 'class-validator';

/** Resultado estructurado de la decision de Gerencia (contrato: ManagementDecisionOutcome). */
export class ManagementDecisionOutcomeDto {
  @IsBoolean() retainGuarantee!: boolean;
  @IsBoolean() terminateContract!: boolean;
}
