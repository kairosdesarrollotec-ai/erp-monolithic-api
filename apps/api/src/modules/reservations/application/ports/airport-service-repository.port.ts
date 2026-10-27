import { AirportServiceRecord, AirportServiceTargetType } from '../../domain/airport-service';

export interface CreateAirportServiceInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  targetType: AirportServiceTargetType;
  targetId: string;
  scheduledAt: Date;
  location: string;
  additionalAmount: string;
  notes?: string | null;
  registeredBy: string;
}

export abstract class AirportServiceRepositoryPort {
  abstract findByTarget(
    targetType: AirportServiceTargetType,
    targetId: string,
    tx?: unknown,
  ): Promise<AirportServiceRecord | null>;

  abstract recordAirportService(
    input: CreateAirportServiceInput,
    tx?: unknown,
  ): Promise<AirportServiceRecord>;
}
