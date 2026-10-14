import { IsIn, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RETURN_ALERT_TYPES, ReturnAlertType } from '../../../application/queries/list-return-alerts.query';

export class ListReturnAlertsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Sin type: ambos tipos de alerta. */
  @IsOptional()
  @IsIn(RETURN_ALERT_TYPES)
  type?: ReturnAlertType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;
}
