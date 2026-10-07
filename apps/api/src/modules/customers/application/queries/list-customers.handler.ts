import { Injectable } from '@nestjs/common';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertCustomerRead } from '../policies/customer-role.policy';
import { ListCustomersQuery } from './list-customers.query';
import { Customer } from '../../domain/customer';

@Injectable()
export class ListCustomersHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListCustomersQuery): Promise<{ items: Customer[]; total: number }> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    assertCustomerRead(context.roleKey);

    return this.customers.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      search: query.search?.trim(),
      limit: Math.min(Math.max(query.limit, 1), 100),
      offset: Math.max(query.offset, 0),
    });
  }
}
