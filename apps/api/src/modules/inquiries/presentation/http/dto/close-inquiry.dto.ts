import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CloseInquiryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() note?: string;
}
