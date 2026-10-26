import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RecordHolderNotificationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) channel!: string;
  @IsDateString() contactedAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) notifiedBy!: string;
  @IsOptional() @IsString() @MaxLength(1000) observations?: string;
}
