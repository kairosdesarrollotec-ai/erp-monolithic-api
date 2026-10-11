import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { TEMPLATE_TYPES } from '../../../domain/template-type';

const ALLOWED_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;

export class ListTemplatesQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsIn(TEMPLATE_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(ALLOWED_STATUSES)
  status?: string;
}
