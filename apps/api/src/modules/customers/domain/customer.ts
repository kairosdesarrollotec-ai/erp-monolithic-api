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
  createdAt: Date;
  updatedAt: Date;
}
