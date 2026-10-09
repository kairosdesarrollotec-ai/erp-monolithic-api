import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class EvaluateFieldTripReturnDto {
  @IsISO8601()
  actualReturn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  returnNotes?: string | null;
}
