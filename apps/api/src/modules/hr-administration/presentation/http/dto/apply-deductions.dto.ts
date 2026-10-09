import { ArrayMaxSize, IsArray, IsOptional, IsUUID, Matches } from 'class-validator';

export class ApplyDeductionsDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener formato YYYY-MM' })
  month!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  employeeIds?: string[];
}
