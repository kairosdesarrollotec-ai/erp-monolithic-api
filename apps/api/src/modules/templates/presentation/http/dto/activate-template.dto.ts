import { IsIn, IsUrl, IsUUID } from 'class-validator';

const ALLOWED_FORMATS = ['PDF', 'DOCX'] as const;

export class ActivateTemplateDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsUrl({ require_tld: true, protocols: ['https'] })
  objectUrl!: string;

  @IsIn(ALLOWED_FORMATS)
  documentFormat!: string;
}
