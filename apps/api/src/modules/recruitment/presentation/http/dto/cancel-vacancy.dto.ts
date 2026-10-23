import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CancelVacancyDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  /** Motivo obligatorio de la cancelacion (REC-02, 22-oct); el dominio lo vuelve a validar tras recortar espacios. */
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
