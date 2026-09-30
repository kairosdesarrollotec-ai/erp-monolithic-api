import { IsString, IsUUID, MinLength } from 'class-validator';

export class ApproveNotaryExceptionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  @MinLength(10)
  justification!: string;
}
