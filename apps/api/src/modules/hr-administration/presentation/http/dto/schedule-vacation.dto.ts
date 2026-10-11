import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class ScheduleVacationDto {
  @Matches(DATE_ONLY_PATTERN, { message: 'startDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate!: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'endDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
