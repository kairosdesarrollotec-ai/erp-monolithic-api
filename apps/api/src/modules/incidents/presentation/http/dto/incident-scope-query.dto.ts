import { IsUUID } from 'class-validator';

/** Query de GET /incidents/:id (contexto de trabajo vigente). */
export class IncidentScopeQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
