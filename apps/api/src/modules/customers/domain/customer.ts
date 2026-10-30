export interface Customer {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality?: 'PERUANO' | 'EXTRANJERO' | null;
  countryEntryDate?: Date | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  /** Semáforo del cliente (H-17, decisión 28-oct #5): NORMAL / AMBAR / ROJO; persiste en Customer.status. */
  riskStatus?: 'NORMAL' | 'AMBAR' | 'ROJO';
  /** Motivo del último cambio del semáforo (H-17); null si nunca cambió o es anterior al registro de motivos. */
  riskReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
