import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { CustomerAccessService } from '../services/customer-access.service';
import { GetCustomerQuery } from './get-customer.query';
import { Customer } from '../../domain/customer';

@Injectable()
export class GetCustomerHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly access: CustomerAccessService,
  ) {}

  async execute(query: GetCustomerQuery): Promise<Customer> {
    const { context } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'READ',
    );

    const customer = await this.customers.findById(query.id, {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
    });

    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        detail: 'El cliente solicitado no existe en esta empresa.',
      });
    }

    return customer;
  }
}
