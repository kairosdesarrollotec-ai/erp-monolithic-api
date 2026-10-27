export type AirportServiceTargetType = 'RESERVATION' | 'RENTAL';

export interface AirportServiceRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  targetType: AirportServiceTargetType;
  targetId: string;
  scheduledAt: Date;
  location: string;
  additionalAmount: string;
  notes: string | null;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}
