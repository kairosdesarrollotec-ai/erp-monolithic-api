import { IsUUID } from 'class-validator';

/**
 * Hallazgo medio de revision PR#4 ("DTOs debiles"): antes solo exigia
 * string no vacio, aceptando cualquier valor arbitrario. companyId y
 * branchId son siempre UUID (ver schema.prisma: Company.id, Branch.id
 * usan @default(uuid())) - se valida el formato aqui, antes de llegar al
 * handler. El rechazo de propiedades desconocidas ya lo cubre el
 * ValidationPipe global (whitelist + forbidNonWhitelisted, ver main.ts).
 */
export class SelectWorkContextDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
