import { IsUUID } from 'class-validator';

export class MarkAllNotificationsReadDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
