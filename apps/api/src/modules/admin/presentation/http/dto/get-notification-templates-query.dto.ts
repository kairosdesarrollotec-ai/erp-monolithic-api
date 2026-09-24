import { IsUUID } from 'class-validator';

export class GetNotificationTemplatesQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
