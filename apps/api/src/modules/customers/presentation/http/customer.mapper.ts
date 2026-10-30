import { Customer } from '../../domain/customer';
import { CustomerResponse } from './dto/customer.response';

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    operatingCompanyId: customer.operatingCompanyId,
    fullName: customer.fullName,
    documentType: customer.documentType,
    documentNumber: customer.documentNumber,
    nationality: customer.nationality ?? null,
    countryEntryDate: customer.countryEntryDate ? customer.countryEntryDate.toISOString().slice(0, 10) : null,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    riskStatus: customer.riskStatus ?? 'NORMAL',
    riskReason: customer.riskReason ?? null,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}
