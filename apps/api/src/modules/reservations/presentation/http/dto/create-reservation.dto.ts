import { IsIn, IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsString() @IsNotEmpty() inquiryId!: string;
  @IsString() @IsNotEmpty() customerId!: string;
  @IsString() @IsNotEmpty() vehicleId!: string;
  @IsString() @IsNotEmpty() companyId!: string;
  @IsString() @IsNotEmpty() branchId!: string;
  @IsIn(['PRESENCIAL', 'VIRTUAL']) channelMode!: 'PRESENCIAL' | 'VIRTUAL';
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
}
