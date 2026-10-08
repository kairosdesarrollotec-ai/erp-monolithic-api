import { IsEnum, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { InterviewResult } from '@prisma/client';

export class RecordInterviewResultDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsEnum(InterviewResult)
  result!: InterviewResult;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  qualitativeNotes!: string;
}
