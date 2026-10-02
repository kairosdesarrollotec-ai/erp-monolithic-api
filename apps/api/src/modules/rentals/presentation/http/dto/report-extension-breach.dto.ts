import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReportExtensionBreachDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
