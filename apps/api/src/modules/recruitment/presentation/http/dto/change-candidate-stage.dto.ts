import { IsEnum, IsUUID } from 'class-validator';
import { CandidateStage } from '@prisma/client';

export class ChangeCandidateStageDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsEnum(CandidateStage)
  stage!: CandidateStage;
}
