import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListAuditEventsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional() @IsString() actorUid?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}
