export interface CustomerResponse {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality?: 'PERUANO' | 'EXTRANJERO' | null;
  countryEntryDate?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCustomersResponse {
  items: CustomerResponse[];
  total: number;
}
