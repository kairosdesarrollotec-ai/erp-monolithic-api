import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Hallazgo critico "bug de bandeja": `companyId` era el UNICO parametro
 * de sede/empresa que aceptaba esta query - el controller reutilizaba su
 * valor tambien como branchId al construir ListReservationsQuery,
 * vaciando siempre la bandeja. `branchId` ahora es un parametro propio y
 * obligatorio (como companyId, TR-05/RES-01 nunca operan sin una sede
 * concreta seleccionada).
 *
 * Hallazgo medio "sin paginacion": limit/cursor* agregados (cursor por
 * createdAt+id, ver ReservationRepositoryPort.list). `limit` se valida
 * aqui como string numerico (el ValidationPipe global no tiene
 * `transform: true`, ver main.ts) y se convierte a number en el
 * controller, mismo criterio que el parseo manual de If-Match.
 */
export class ListReservationsQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'PENDING_SALE_RESOLUTION', 'CONVERTED', 'CANCELLED'])
  status?: 'DRAFT' | 'CONFIRMED' | 'PENDING_SALE_RESOLUTION' | 'CONVERTED' | 'CANCELLED';

  @IsOptional()
  @Matches(/^[1-9]\d*$/, { message: 'limit debe ser un entero positivo.' })
  limit?: string;

  @IsOptional() @IsISO8601() cursorCreatedAt?: string;
  @IsOptional() @IsUUID() cursorId?: string;
}
