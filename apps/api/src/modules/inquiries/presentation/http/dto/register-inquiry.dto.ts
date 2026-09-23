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
} from 'class-validator';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TDD-CON-001.md 11.1 + snapshot de CON-02 (hallazgo ALTO de revalidacion
 * PR#7, "brecha contractual con CON-02"; PANTALLAS-V3-B-CONSULTA.md punto 6
 * y BDD-CON-001.md DAT-CON-001..004). Contrato en
 * packages/contracts/openapi/inquiries.yaml (RegisterInquiryRequest).
 */
export class RegisterInquiryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** DAT-CON-004 */
  @IsIn(['WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'WEB', 'REDES'])
  channel!: 'WHATSAPP' | 'LLAMADA' | 'PRESENCIAL' | 'WEB' | 'REDES';

  @IsOptional() @IsUUID() customerId?: string;

  /** DAT-CON-001 */
  @IsBoolean() touristUse!: boolean;

  /** CON-P02 - obligatorio si no hay customerId (validado en el handler). */
  @IsOptional() @IsString() @MaxLength(200) prospectName?: string;
  @IsOptional() @IsString() @MaxLength(30) prospectDocumentType?: string;
  @IsOptional() @IsString() @MaxLength(30) prospectDocumentNumber?: string;

  /** DAT-CON-002 */
  @IsIn(['PERUANO', 'EXTRANJERO']) nationality!: 'PERUANO' | 'EXTRANJERO';

  /** DAT-CON-003 */
  @IsString() @IsNotEmpty() @MaxLength(200) destination!: string;
  @IsInt() @IsPositive() estimatedDays!: number;

  /** CON-02 "periodo/fecha" y "personas" (opcionales). Fechas YYYY-MM-DD. */
  @IsOptional() @Matches(ISO_DATE_ONLY, { message: 'travelStartDate debe tener formato YYYY-MM-DD.' })
  travelStartDate?: string;
  @IsOptional() @IsInt() @IsPositive() partySize?: number;

  /** SC-CON-001.03 - solo EXTRANJERO (validado en el handler y por CHECK). */
  @IsOptional() @Matches(ISO_DATE_ONLY, { message: 'countryEntryDate debe tener formato YYYY-MM-DD.' })
  countryEntryDate?: string;
}
