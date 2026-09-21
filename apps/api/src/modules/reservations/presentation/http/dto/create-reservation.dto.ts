import { IsIn, IsISO8601, IsUUID } from 'class-validator';

/**
 * Hallazgo medio de revision PR#6 ("DTOs sin formato fuerte"): companyId/
 * branchId/inquiryId/customerId/vehicleId son UUIDs en el esquema
 * (schema.prisma) - `@IsUUID()` en vez de `@IsString()` rechaza en el
 * borde HTTP cualquier valor que ni siquiera tiene forma de id valido,
 * mismo patron que get-dashboard.dto.ts desde la correccion de PR#5.
 */
export class CreateReservationDto {
  @IsUUID() inquiryId!: string;
  @IsUUID() customerId!: string;
  @IsUUID() vehicleId!: string;
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsIn(['PRESENCIAL', 'VIRTUAL']) channelMode!: 'PRESENCIAL' | 'VIRTUAL';
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
}
