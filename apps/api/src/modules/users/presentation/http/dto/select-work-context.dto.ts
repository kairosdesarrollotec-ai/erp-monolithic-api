import { IsString, IsNotEmpty } from 'class-validator';

export class SelectWorkContextDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
