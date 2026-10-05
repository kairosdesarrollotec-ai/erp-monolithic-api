import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ALCOHOL_ESCALATION_DECISIONS, AlcoholEscalationDecision } from '../../../domain/return-status';

export class ResolveAlcoholEscalationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(ALCOHOL_ESCALATION_DECISIONS)
  decision!: AlcoholEscalationDecision;

  @IsBoolean()
  markCustomerRed!: boolean;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  notes!: string;
}
