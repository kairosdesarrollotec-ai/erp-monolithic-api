import { IsNotEmpty, IsString } from 'class-validator';

/** Cuerpo comun de los comandos de transicion (companyId/branchId del contexto de trabajo vigente). */
export class CommandScopeDto {
  @IsString() @IsNotEmpty() companyId!: string;
  @IsString() @IsNotEmpty() branchId!: string;
}
