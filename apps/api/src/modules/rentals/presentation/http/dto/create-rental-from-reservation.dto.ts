import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateRentalFromReservationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn(['NORMAL', 'PLUS', 'LIBRE'])
  planCode?: string;
}
