import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Hallazgo MEDIO de revalidacion PR#7: `limit` se valida aqui como entero
 * positivo y el maximo (100, INQUIRY_LIST_MAX_LIMIT) en
 * ListInquiriesHandler - mismo valor que declara OpenAPI. El cursor es el
 * par (cursorCreatedAt, cursorId) de la ultima fila de la pagina anterior
 * (keyset real, ver PrismaInquiryRepository.list).
 *
 * Hallazgo critico "bandeja rota": `branchId` ahora es su propio
 * parametro obligatorio (antes el controller reutilizaba companyId
 * tambien como branchId, vaciando siempre la bandeja).
 *
 * Hallazgo medio "sin paginacion": limit/cursor* agregados, mismo
 * criterio que `reservations` (el ValidationPipe global no tiene
 * `transform: true`, ver main.ts - `limit` se valida como string
 * numerico y se convierte en el controller).
 */
export class ListInquiriesQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsOptional() @IsUUID() customerId?: string;

  @IsOptional()
  @IsIn(['WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'WEB', 'REDES'])
  channel?: 'WHATSAPP' | 'LLAMADA' | 'PRESENCIAL' | 'WEB' | 'REDES';

  @IsOptional()
  @IsIn(['REGISTRADA', 'COTIZADA', 'CONVERTIDA', 'CERRADA_SIN_CONVERSION'])
  status?: 'REGISTRADA' | 'COTIZADA' | 'CONVERTIDA' | 'CERRADA_SIN_CONVERSION';

  @IsOptional() @IsISO8601() createdFrom?: string;
  @IsOptional() @IsISO8601() createdTo?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/, { message: 'limit debe ser un entero positivo.' })
  limit?: string;

  @IsOptional() @IsISO8601() cursorCreatedAt?: string;
  @IsOptional() @IsUUID() cursorId?: string;
}
