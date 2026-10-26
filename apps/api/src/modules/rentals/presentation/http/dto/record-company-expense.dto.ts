import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class RecordCompanyExpenseDto {
  @IsUUID() companyId!: string;

  @IsUUID() branchId!: string;

  @IsIn(['GASTO_NOTARIAL'])
  expenseType!: 'GASTO_NOTARIAL';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, {
    message: 'expenseDate debe ser una fecha ISO válida',
  })
  expenseDate!: string;

  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  paidByCustomer?: boolean;
}

export interface CompanyExpenseResponse {
  id: string;
  companyId: string;
  rentalId: string | null;
  expenseType: 'GASTO_NOTARIAL';
  amount: number;
  currency: string;
  expenseDate: string;
  reference: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}
