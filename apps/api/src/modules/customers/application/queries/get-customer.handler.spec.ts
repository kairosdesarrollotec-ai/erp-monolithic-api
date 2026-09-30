import { NotFoundException } from '@nestjs/common';
import { GetCustomerHandler } from './get-customer.handler';
import { GetCustomerQuery } from './get-customer.query';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildCustomer,
  buildCustomerRepository,
  buildWorkContext,
} from '../../testing/customer-test-fixtures';

describe('GetCustomerHandler', () => {
  it('obtiene un cliente existente para el contexto autorizado', async () => {
    const customer = buildCustomer();
    const repository = buildCustomerRepository(customer);
    const workContext = buildWorkContext();
    const handler = new GetCustomerHandler(repository, workContext);

    const query = new GetCustomerQuery('uid-1', 'cust-1', COMPANY, BRANCH);
    const result = await handler.execute(query);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findById).toHaveBeenCalledWith('cust-1', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(result.id).toBe('cust-1');
  });

  it('lanza NotFoundException si el cliente no existe en la empresa autorizada', async () => {
    const repository = buildCustomerRepository(null);
    const workContext = buildWorkContext();
    const handler = new GetCustomerHandler(repository, workContext);

    const query = new GetCustomerQuery('uid-1', 'inexistente', COMPANY, BRANCH);

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });
});
