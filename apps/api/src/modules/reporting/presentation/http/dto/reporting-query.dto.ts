import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * Parámetros de query comunes a los endpoints de KPIs operativos.
 * BR-REP-004: companyId y branchId son obligatorios para el aislamiento multiempresa.
 *
 * NOTA: El contrato OpenAPI (reporting.yaml) declara branchId como opcional,
 * pero la infraestructura de autenticación (WorkContextAuthorizationService) requiere
 * un contexto empresa+sede válido. La extensión "datos sin filtro de sede" queda
 * pendiente de OQ-REP-001 (CORPORATE_AUDITOR / PLATFORM_ADMIN con vista consolidada).
 */
export class OperationalKpisQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

/**
 * Parámetros de query para KPIs financieros.
 * BR-REP-005: dateFrom y dateTo son obligatorios; rango máximo 90 días.
 */
export class FinancialKpisQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}

/**
 * Parámetros de query para la exportación CSV.
 * BR-REP-003 / BR-REP-005.
 */
export class ExportQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsIn(['operational', 'financial', 'combined'])
  type?: 'operational' | 'financial' | 'combined';
}
