import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class GetEmployeeAttendanceQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener formato YYYY-MM' })
  month?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'startDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'endDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate?: string;
}
