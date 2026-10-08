import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CandidateDecision } from '@prisma/client';

export class DecideCandidateDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsEnum(CandidateDecision)
  decision!: CandidateDecision;

  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
