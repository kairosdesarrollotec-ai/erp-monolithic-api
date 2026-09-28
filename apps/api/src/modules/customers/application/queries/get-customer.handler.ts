import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { GetCustomerQuery } from './get-customer.query';
import { Customer } from '../../domain/customer';

@Injectable()
export class GetCustomerHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: GetCustomerQuery): Promise<Customer> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

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
