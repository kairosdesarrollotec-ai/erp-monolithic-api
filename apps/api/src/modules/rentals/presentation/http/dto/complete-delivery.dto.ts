import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CompleteDeliveryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsInt()
  @Min(0)
  photosCount!: number;

  @IsInt()
  @Min(0)
  videosCount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
