import { IsUUID } from 'class-validator';

export class ResumeVacancyDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
