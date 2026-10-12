import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectFieldTripDto {
  /** Motivo del rechazo (obligatorio): queda en el expediente de la salida y en la auditoría. */
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
