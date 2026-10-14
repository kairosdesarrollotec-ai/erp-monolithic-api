import { IsIn, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RETURN_REMINDER_STATUSES, ReturnReminderStatus } from '../../../domain/return-reminder';

export class ListReturnRemindersQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Sin status: pendientes + fallidos (bandeja de trabajo). */
  @IsOptional()
  @IsIn(RETURN_REMINDER_STATUSES)
  status?: ReturnReminderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;
}
