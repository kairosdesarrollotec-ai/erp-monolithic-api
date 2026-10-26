import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordExpectationDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileUrl!: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
