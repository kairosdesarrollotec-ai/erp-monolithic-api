import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RecordCandidateCvDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  objectUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName!: string;
}
