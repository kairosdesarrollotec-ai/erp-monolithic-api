import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Evaluacion notarial. `biometricVerified` es la casilla que registra el personal tras la verificacion biometrica facial
 * (RENIEC/MTC estan fuera del MVP, DEC-MVP-RENIEC-MTC-EXCL): queda auditada junto con quien la marco. Por defecto false.
 */
export class EvaluateNotaryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsBoolean()
  biometricVerified?: boolean;
}
