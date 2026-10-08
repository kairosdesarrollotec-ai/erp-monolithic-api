import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CandidateStage } from '@prisma/client';

export class ListCandidatesQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsEnum(CandidateStage)
  stage?: CandidateStage;
}
