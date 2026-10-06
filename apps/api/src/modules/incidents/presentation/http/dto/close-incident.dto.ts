import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { INCIDENT_TEXT_MAX_LENGTH } from '../../../domain/incident-catalog';

/** Cuerpo de `resolve` y `close` (contrato: CloseIncidentRequest). */
export class CloseIncidentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() @IsNotEmpty() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) resolutionSummary!: string;
}
