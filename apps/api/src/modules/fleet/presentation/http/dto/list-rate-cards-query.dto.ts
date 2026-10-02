import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class ListRateCardsQueryDto {
  @IsString()
  companyId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;
}
