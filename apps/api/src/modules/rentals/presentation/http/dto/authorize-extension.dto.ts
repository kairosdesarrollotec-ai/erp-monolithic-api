import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AuthorizeExtensionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsString()
  addendumDocumentRef?: string;
}
