import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from '../../../domain/incident-catalog';

/**
 * Bandeja INC-01. `limit` se valida como string numerico (el ValidationPipe global no usa `transform: true`) y el
 * maximo (100) en el controller - mismo valor que declara OpenAPI. El cursor es el par (cursorCreatedAt, cursorId) de
 * la ultima fila de la pagina anterior (keyset real).
 */
export class ListIncidentsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional() @IsIn(INCIDENT_TYPES) type?: IncidentType;
  @IsOptional() @IsIn(INCIDENT_SEVERITIES) severity?: IncidentSeverity;
  @IsOptional() @IsIn(INCIDENT_STATUSES) status?: IncidentStatus;
  @IsOptional() @IsUUID() rentalId?: string;
  @IsOptional() @IsUUID() returnId?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/, { message: 'limit debe ser un entero positivo.' })
  limit?: string;

  @IsOptional() @IsISO8601() cursorCreatedAt?: string;
  @IsOptional() @IsUUID() cursorId?: string;
}
