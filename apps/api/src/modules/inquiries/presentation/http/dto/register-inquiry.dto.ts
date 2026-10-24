import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * CONFLICT-CON-002 (resuelto): la identidad del prospecto se separa en
 * un sub-objeto anidado. Cuando llega `prospect` (sin `customerId`) el
 * handler crea primero el Customer.
 */
export class ProspectDto {
  @IsString() @IsNotEmpty() @MaxLength(200) fullName!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) documentType!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) documentNumber!: string;
  @IsIn(['PERUANO', 'EXTRANJERO']) nationality!: 'PERUANO' | 'EXTRANJERO';
  /** SC-CON-001.03 - solo EXTRANJERO (validado en el handler). */
  @IsOptional() @Matches(ISO_DATE_ONLY, { message: 'countryEntryDate debe tener formato YYYY-MM-DD.' })
  countryEntryDate?: string;
}

/**
 * TDD-CON-001.md 11.1 - registro de consulta CON-02.
 * Contrato en packages/contracts/openapi/inquiries.yaml (RegisterInquiryRequest).
 *
 * Debe llegar exactamente uno de `customerId` o `prospect`; validado en el handler.
 */
export class RegisterInquiryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** DAT-CON-004 */
  @IsIn(['WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'WEB', 'REDES'])
  channel!: 'WHATSAPP' | 'LLAMADA' | 'PRESENCIAL' | 'WEB' | 'REDES';

  /** Cliente formal existente. Mutuamente exclusivo con `prospect`. */
  @IsOptional() @IsUUID() customerId?: string;

  /** Datos del prospecto cuando no existe Customer previo. */
  @IsOptional() @ValidateNested() @Type(() => ProspectDto) prospect?: ProspectDto;

  /** DAT-CON-001 */
  @IsBoolean() touristUse!: boolean;

  /** DAT-CON-003 */
  @IsString() @IsNotEmpty() @MaxLength(200) destination!: string;
  @IsInt() @IsPositive() estimatedDays!: number;

  /** CON-02 "periodo/fecha" y "personas" (opcionales). Fechas YYYY-MM-DD. */
  @IsOptional() @Matches(ISO_DATE_ONLY, { message: 'travelStartDate debe tener formato YYYY-MM-DD.' })
  travelStartDate?: string;
  @IsOptional() @IsInt() @IsPositive() partySize?: number;

  /** DEC-CON-TROCHA-001 */
  @IsOptional() @IsBoolean() isDirtRoad?: boolean;
}
