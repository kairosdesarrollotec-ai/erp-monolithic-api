import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RecordMechanicReportDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsBoolean() accepted!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
