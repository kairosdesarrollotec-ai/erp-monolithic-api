import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { ManagementDecisionOutcomeDto } from './management-decision-outcome.dto';
import { INCIDENT_TEXT_MAX_LENGTH } from '../../../domain/incident-catalog';

export class ReferLegalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() @IsNotEmpty() @MaxLength(INCIDENT_TEXT_MAX_LENGTH) reason!: string;

  @IsOptional() @ValidateNested() @Type(() => ManagementDecisionOutcomeDto) decision?: ManagementDecisionOutcomeDto;
}
