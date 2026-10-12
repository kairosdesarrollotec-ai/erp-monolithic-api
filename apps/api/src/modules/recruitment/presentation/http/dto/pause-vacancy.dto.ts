import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PauseVacancyDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
