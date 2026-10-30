import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AlcoholTestResult } from '../../../domain/alcohol-test-result';

export class RegisterAlcoholTestDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['FAVORABLE', 'DESFAVORABLE', 'RECHAZADO'])
  result!: AlcoholTestResult;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  reniecVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  mtcVerified?: boolean;

  /** Excepcion de RENIEC autorizada por Gerencia; requiere motivo. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  reniecExceptionReason?: string;
}
