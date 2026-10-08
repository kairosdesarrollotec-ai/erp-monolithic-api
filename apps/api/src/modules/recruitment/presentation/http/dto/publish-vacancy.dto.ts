import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PublishVacancyDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  profileDescription!: string;

  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  scheduleDetails!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  channels!: string[];
}
