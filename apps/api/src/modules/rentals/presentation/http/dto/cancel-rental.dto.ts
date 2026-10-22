import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RENTAL_CANCEL_REASONS } from '../../../domain/rental-cancel-reason';

/** DEC-ALQ-CANCEL-001: cancelacion manual antes de la entrega. */
export class CancelRentalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Motivo obligatorio. OTHER exige `note` de al menos 10 caracteres. */
  @IsIn(RENTAL_CANCEL_REASONS) reason!: (typeof RENTAL_CANCEL_REASONS)[number];

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
