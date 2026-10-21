import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ManagementDecisionOutcomeDto } from './management-decision-outcome.dto';
import { INCIDENT_TEXT_MAX_LENGTH } from '../../../domain/incident-catalog';

/** Cuerpo de `resolve` y `close` (contrato: CloseIncidentRequest). */
export class CloseIncidentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() @IsNotEmpty() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) resolutionSummary!: string;

  @IsOptional() @ValidateNested() @Type(() => ManagementDecisionOutcomeDto) decision?: ManagementDecisionOutcomeDto;
}
