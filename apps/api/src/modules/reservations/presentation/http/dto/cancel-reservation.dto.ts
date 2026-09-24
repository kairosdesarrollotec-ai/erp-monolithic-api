import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelReservationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['CUSTOMER_REQUESTED_CHANGE', 'NO_SHOW'])
  reason!: 'CUSTOMER_REQUESTED_CHANGE' | 'NO_SHOW';

  @IsOptional() @IsString() note?: string;
}
