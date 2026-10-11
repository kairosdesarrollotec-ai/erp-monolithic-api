import { IsUUID, Matches } from 'class-validator';

export class AttendanceSummaryQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener formato YYYY-MM' })
  month!: string;
}
