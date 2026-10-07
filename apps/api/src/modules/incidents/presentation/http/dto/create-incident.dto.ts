import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TEXT_MAX_LENGTH,
  INCIDENT_TYPES,
  type IncidentSeverity,
  type IncidentType,
} from '../../../domain/incident-catalog';

export class CreateIncidentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() rentalId!: string;
  @IsOptional() @IsUUID() returnId?: string;

  @IsIn(INCIDENT_TYPES) type!: IncidentType;
  @IsIn(INCIDENT_SEVERITIES) severity!: IncidentSeverity;

  @IsString() @IsNotEmpty() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) description!: string;
  @IsOptional() @IsString() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) suggestion?: string;

  @IsOptional() @IsISO8601() reportedAt?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) responsibleUserId?: string;
}
