import { IsUUID } from 'class-validator';

export class RejectExtensionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
