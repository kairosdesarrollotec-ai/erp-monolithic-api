import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListReservationsQueryDto {
  @IsOptional() @IsString() companyId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'PENDING_SALE_RESOLUTION', 'CONVERTED', 'CANCELLED'])
  status?: 'DRAFT' | 'CONFIRMED' | 'PENDING_SALE_RESOLUTION' | 'CONVERTED' | 'CANCELLED';
}
