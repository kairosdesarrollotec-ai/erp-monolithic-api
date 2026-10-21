import { IsUUID } from 'class-validator';

/** Contexto de trabajo para activar/desactivar un area (POST /hr-areas/{code}/deactivate | /reactivate). */
export class HrAreaContextDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
