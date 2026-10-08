import { ListCustomersHandler } from './list-customers.handler';
import { ListCustomersQuery } from './list-customers.query';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildCustomer,
  buildCustomerRepository,
  buildCustomerAccessService,
} from '../../testing/customer-test-fixtures';

describe('ListCustomersHandler', () => {
  it('autoriza contexto y delega búsqueda al repositorio con paginación', async () => {
    const customer = buildCustomer();
    const repository = buildCustomerRepository(customer);
    const { access, workContext } = buildCustomerAccessService();
    const handler = new ListCustomersHandler(repository, access);

    const query = new ListCustomersQuery('uid-1', COMPANY, BRANCH, 'Perez', 20, 0);
    const result = await handler.execute(query);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.list).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      search: 'Perez',
      limit: 20,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
