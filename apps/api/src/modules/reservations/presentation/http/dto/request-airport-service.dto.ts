import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CommandScopeDto } from './command-scope.dto';

export class RequestAirportServiceDto extends CommandScopeDto {
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location!: string;

  @IsString()
  @Matches(/^[0-9]+(\.[0-9]{1,2})?$/, {
    message: 'additionalAmount debe ser un monto decimal valido con hasta 2 decimales.',
  })
  additionalAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
