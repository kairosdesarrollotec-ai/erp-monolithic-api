import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, IsUUID, ValidateNested } from 'class-validator';
import { RETURN_ZONE_MARK_VALUES, RETURN_ZONE_MARK_ZONES } from '../../../domain/return-zone-marks';

export class ZoneMarkItemDto {
  @IsString()
  @IsIn([...RETURN_ZONE_MARK_ZONES])
  zone!: string;

  @IsString()
  @IsIn([...RETURN_ZONE_MARK_VALUES])
  mark!: string;
}

/** DEV-05 / PD-07: marcas por zona del comparador "Resultado". Solo las zonas enviadas se crean o actualizan. */
export class RecordZoneMarksDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ZoneMarkItemDto)
  marks!: ZoneMarkItemDto[];
}
