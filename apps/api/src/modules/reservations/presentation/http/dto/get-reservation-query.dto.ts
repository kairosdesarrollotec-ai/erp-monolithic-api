import { IsUUID } from 'class-validator';

/**
 * Hallazgo MEDIO de revision PR#6 ("parametros de query sin validar" -
 * `detail()` recibia companyId/branchId como `@Query('companyId')
 * companyId: string` crudo, sin ninguna forma de validacion - cualquier
 * string llegaba hasta WorkContextAuthorizationService.authorize()).
 * Mismo patron que ListReservationsQueryDto.
 */
export class GetReservationQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
