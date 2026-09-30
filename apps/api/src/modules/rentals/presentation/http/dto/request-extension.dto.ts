import { IsISO8601, IsUUID } from 'class-validator';

export class RequestExtensionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsISO8601()
  requestedEndAt!: string;
}
