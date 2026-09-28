import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCustomerDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentNumber!: string;

  @IsOptional()
  @IsIn(['PERUANO', 'EXTRANJERO'])
  nationality?: 'PERUANO' | 'EXTRANJERO';

  @IsOptional()
  @Matches(ISO_DATE_ONLY, { message: 'countryEntryDate debe tener formato YYYY-MM-DD.' })
  countryEntryDate?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email debe ser un correo válido.' })
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
