import { IsISO8601, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

/** #10 (22-oct): reprogramar vacaciones a otra fecha libre; el motivo es obligatorio. */
export class RescheduleVacationDto {
  @Matches(DATE_ONLY_PATTERN, { message: 'startDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate!: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'endDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CancelVacationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
