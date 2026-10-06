import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

/** BR-DEV-009 / DAT-DEV-005 / EX-DEV-001. La validez jurídica de la firma está pendiente de Legal (PROP-012). */
export class ResponsibilityDocumentDto {
  @IsString()
  @MaxLength(200)
  signerName!: string;

  @IsBoolean()
  signerIsHolder!: boolean;

  /** Obligatorio si signerIsHolder=false (lo exige el dominio -> 422). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signerRelationToHolder?: string;

  @IsString()
  @MaxLength(500_000)
  signatureData!: string;
}

export class CompleteInspectionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsBoolean()
  hasDamages!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  damagesDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /**
   * OBLIGATORIO en el contrato. En el DTO se declara opcional a propósito: su ausencia debe responder
   * 422 MISSING_RESPONSIBILITY_DOCUMENT (TDD §11.4) desde el dominio, no 400 de validación de forma.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ResponsibilityDocumentDto)
  responsibilityDocument?: ResponsibilityDocumentDto;
}
