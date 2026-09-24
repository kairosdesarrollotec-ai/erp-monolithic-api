import { IsUUID } from 'class-validator';

/**
 * Hallazgo alto de revision PR#5 ("DTOs sin formato fuerte"): antes solo
 * exigia string no vacio (@IsString/@IsNotEmpty), aceptando cualquier
 * valor arbitrario en un query param de solo lectura. companyId y
 * branchId son siempre UUID (ver schema.prisma: Company.id, Branch.id
 * usan @default(uuid())), igual que en SelectWorkContextDto (TR-05,
 * PR#4) - se valida el formato aqui, antes de llegar al handler.
 */
export class GetDashboardDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
