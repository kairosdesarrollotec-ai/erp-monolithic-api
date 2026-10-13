import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AuthorizeFieldTripDto {
  /** Nivel de la cascada que se autoriza: 1, 2 o 3 ("Nivel 1 de 3"...). NUNCA 4: no existe un 4to nivel automático (BR-ADP-004). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  authorizationLevel!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
