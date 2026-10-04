import { IsUUID } from 'class-validator';

export class ListDocumentsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
