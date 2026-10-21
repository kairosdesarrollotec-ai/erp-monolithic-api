import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { HOLDER_TYPES, HolderType } from '../../../domain/contract-variant';

/** Acompanante autorizado de persona NATURAL (BDD ALQ-P03, Ficha AS-IS "Excepcion de conductor"). */
export class RegisterCompanionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Cliente (persona) con licencia vigente que firma como responsable del contrato. */
  @IsUUID()
  companionCustomerId!: string;

  /** Conductor real del alquiler (parte DRIVER): obligatorio cuando firma un acompanante. */
  @IsUUID()
  driverCustomerId!: string;

  /** Check "licencia vigente verificada" del acompanante (la licencia no se guarda). */
  @IsBoolean()
  companionLicenseVerified!: boolean;

  /** Check "licencia vigente verificada" del conductor real (la licencia no se guarda). */
  @IsBoolean()
  driverLicenseVerified!: boolean;

  /** Motivo por el que el titular no puede firmar. */
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  /** Referencia documental opcional (la autorizacion del acompanante es la del firmante; no se exige documento aparte). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addendumDocumentRef?: string;

  /** Solo si el alquiler aun no tiene contrato formalizado (si lo tiene se toma del contrato). */
  @IsOptional()
  @IsIn(HOLDER_TYPES)
  holderType?: HolderType;
}
