import { IsIn, IsNumberString, IsUUID } from 'class-validator';

export class UpdateReservationDepositPolicyDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsNumberString({}, { message: 'amount debe ser un numero (como string, ej. "350.00").' })
  amount!: string;

  @IsIn(['PEN', 'USD'])
  currency!: string;
}
