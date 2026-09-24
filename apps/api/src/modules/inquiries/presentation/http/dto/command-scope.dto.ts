import { IsUUID } from 'class-validator';

/** Cuerpo comun de los comandos de transicion (companyId/branchId del contexto de trabajo vigente), mismo patron que reservations/presentation/http/dto/command-scope.dto.ts. */
export class CommandScopeDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
