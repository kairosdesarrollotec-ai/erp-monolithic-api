import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class RegisterTrainingDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic!: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'heldOn debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  heldOn!: string;

  /** Referencia: ~1 hora (BR-ADP-008). No es bloqueante; si no se envía se asume 60. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  attendeeIds!: string[];

  /** Nota cualitativa simple de comprensión general; NO es una evaluación formal de desempeño (BR-ADP-007). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comprehensionNotes?: string | null;
}
