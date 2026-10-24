import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CloseReturnDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Firma digital capturada como base64 PNG. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  signatureData?: string;

  /** BR-DEV-010: el acta de devolución de garantía es opcional y no bloquea el cierre. */
  @IsOptional()
  @IsBoolean()
  generateWarrantyAct?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** DEC-DEV-OFFLINE-001: si es true, responde 422 RETURN_OFFLINE_CHANGES_PENDING */
  @IsOptional()
  @IsBoolean()
  hasPendingOfflineChanges?: boolean;
}
