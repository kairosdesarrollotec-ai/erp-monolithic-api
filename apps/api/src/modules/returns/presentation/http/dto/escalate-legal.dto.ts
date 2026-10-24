import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class EscalateLegalDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  notes!: string;
}
