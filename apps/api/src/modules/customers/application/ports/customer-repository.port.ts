import { Customer } from '../../domain/customer';

export interface CreateCustomerData {
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
}

export interface UpdateCustomerData {
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality?: 'PERUANO' | 'EXTRANJERO' | null;
  countryEntryDate?: Date | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ListCustomersFilter {
  organizationId: string;
  operatingCompanyId: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export abstract class CustomerRepositoryPort {
  abstract findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<Customer | null>;

  abstract findByDocument(
    documentType: string,
    documentNumber: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<Customer | null>;

  abstract list(filter: ListCustomersFilter): Promise<{ items: Customer[]; total: number }>;

  abstract create(data: CreateCustomerData): Promise<Customer>;

  abstract update(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    data: UpdateCustomerData,
  ): Promise<Customer>;
}
