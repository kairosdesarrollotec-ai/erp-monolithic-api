import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class GetMyNotificationsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  unreadOnly?: string;
}
