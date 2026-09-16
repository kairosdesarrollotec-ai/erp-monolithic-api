import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelReservationDto {
  @IsString() @IsNotEmpty() companyId!: string;
  @IsString() @IsNotEmpty() branchId!: string;

  @IsIn(['CUSTOMER_REQUESTED_CHANGE', 'NO_SHOW'])
  reason!: 'CUSTOMER_REQUESTED_CHANGE' | 'NO_SHOW';

  @IsOptional() @IsString() note?: string;
}
