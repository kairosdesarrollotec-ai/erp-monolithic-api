import { IsIn, IsInt, IsPositive, IsUUID } from 'class-validator';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export class RequestTemplateUploadUrlDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;

  @IsInt()
  @IsPositive()
  contentLength!: number;
}
