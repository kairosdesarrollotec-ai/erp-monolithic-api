import { IsUUID } from 'class-validator';

/** Hallazgo MEDIO de revalidacion PR#7 ("faltan validaciones UUID"): GET /inquiries/:id. */
export class GetInquiryQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
