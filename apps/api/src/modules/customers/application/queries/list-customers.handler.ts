import { Injectable } from '@nestjs/common';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { CustomerAccessService } from '../services/customer-access.service';
import { ListCustomersQuery } from './list-customers.query';
import { Customer } from '../../domain/customer';

@Injectable()
export class ListCustomersHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly access: CustomerAccessService,
  ) {}

  async execute(query: ListCustomersQuery): Promise<{ items: Customer[]; total: number }> {
    const { context } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'READ',
    );

    return this.customers.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      search: query.search?.trim(),
      limit: Math.min(Math.max(query.limit, 1), 100),
      offset: Math.max(query.offset, 0),
    });
  }
}
