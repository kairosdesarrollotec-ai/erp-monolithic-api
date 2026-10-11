import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestFieldTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destination!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  objective!: string;

  @IsISO8601()
  estimatedDeparture!: string;

  @IsISO8601()
  estimatedReturn!: string;
}
