import { IsIn, IsUUID } from 'class-validator';
import { VehicleStatus } from '../../../domain/vehicle';

export class UpdateVehicleStatusDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  status!: VehicleStatus;
}
