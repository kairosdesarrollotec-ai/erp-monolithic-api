import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { INCIDENT_TEXT_MAX_LENGTH } from '../../../domain/incident-catalog';

export class AddIncidentActionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() @IsNotEmpty() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) description!: string;
}
