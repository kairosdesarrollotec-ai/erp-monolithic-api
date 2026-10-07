import { IsUUID } from 'class-validator';

export class VacancyScopeQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
