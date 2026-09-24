import { IsUUID } from 'class-validator';

/** Cuerpo comun de los comandos de transicion (companyId/branchId del contexto de trabajo vigente). */
export class CommandScopeDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
