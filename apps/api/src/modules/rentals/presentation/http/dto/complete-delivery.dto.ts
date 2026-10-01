import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CompleteDeliveryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /**
   * @deprecated informativo unicamente - BR-INS-003/004 ahora se valida
   * contra el conteo real de evidencia (RentalEvidence), no contra estos
   * contadores enviados por el cliente. Se mantienen opcionales por
   * compatibilidad con clientes que aun no migraron al flujo de subida de
   * archivos.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  photosCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  videosCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
