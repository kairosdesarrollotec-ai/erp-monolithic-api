import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateCustomerHandler } from './update-customer.handler';
import { UpdateCustomerCommand } from './update-customer.command';
import { CustomerDocumentAlreadyExistsError } from '../../domain/customer-errors';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildCustomer,
  buildCustomerRepository,
  buildWorkContext,
} from '../../testing/customer-test-fixtures';

describe('UpdateCustomerHandler', () => {
  it('actualiza un cliente existente con datos sanitizados', async () => {
    const existing = buildCustomer({ id: 'cust-1', documentNumber: '70889900' });
    const repository = buildCustomerRepository(existing);
    const workContext = buildWorkContext();
    const handler = new UpdateCustomerHandler(repository, workContext);

    const command = new UpdateCustomerCommand(
      'uid-1',
      'cust-1',
      COMPANY,
      BRANCH,
      '  Carlos Mendoza  ',
      'dni',
      ' 70889900 ',
      'PERUANO',
      undefined,
      ' Carlos.Mendoza@GMAIL.COM ',
      ' 987654321 ',
      ' Av. Siempre Viva 123 ',
    );

    const result = await handler.execute(command);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findById).toHaveBeenCalledWith('cust-1', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(repository.update).toHaveBeenCalledWith(
      'cust-1',
      { organizationId: ORG, operatingCompanyId: COMPANY },
      {
        fullName: 'Carlos Mendoza',
        documentType: 'DNI',
        documentNumber: '70889900',
        nationality: 'PERUANO',
        countryEntryDate: undefined,
        email: 'carlos.mendoza@gmail.com',
        phone: '987654321',
        address: 'Av. Siempre Viva 123',
      },
    );
    expect(result.fullName).toBe('Carlos Mendoza');
  });

  it('rechaza countryEntryDate si el cliente no es extranjero', async () => {
    const existing = buildCustomer({ id: 'cust-1' });
    const repository = buildCustomerRepository(existing);
    const workContext = buildWorkContext();
    const handler = new UpdateCustomerHandler(repository, workContext);

    const command = new UpdateCustomerCommand(
      'uid-1',
      'cust-1',
      COMPANY,
      BRANCH,
      'Maria Lopez',
      'DNI',
      '44556677',
      'PERUANO',
      new Date('2026-09-01T00:00:00Z'),
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('falla con NotFoundException si el cliente no existe en la empresa', async () => {
    const repository = buildCustomerRepository(null);
    const workContext = buildWorkContext();
    const handler = new UpdateCustomerHandler(repository, workContext);

    const command = new UpdateCustomerCommand(
      'uid-1',
      'cust-inexistente',
      COMPANY,
      BRANCH,
      'Maria Lopez',
      'DNI',
      '44556677',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('falla con CustomerDocumentAlreadyExistsError si el documento pertenece a otro cliente', async () => {
    const existing = buildCustomer({ id: 'cust-1', documentType: 'DNI', documentNumber: '11111111' });
    const other = buildCustomer({ id: 'cust-2', documentType: 'DNI', documentNumber: '22222222' });
    const repository = buildCustomerRepository(existing);
    repository.findByDocument.mockResolvedValue(other);

    const workContext = buildWorkContext();
    const handler = new UpdateCustomerHandler(repository, workContext);

    const command = new UpdateCustomerCommand(
      'uid-1',
      'cust-1',
      COMPANY,
      BRANCH,
      'Juan Perez',
      'DNI',
      '22222222',
    );

    await expect(handler.execute(command)).rejects.toThrow(CustomerDocumentAlreadyExistsError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('permite conservar el mismo documento del propio cliente', async () => {
    const existing = buildCustomer({ id: 'cust-1', documentType: 'DNI', documentNumber: '11111111' });
    const repository = buildCustomerRepository(existing);
    repository.findByDocument.mockResolvedValue(existing);

    const workContext = buildWorkContext();
    const handler = new UpdateCustomerHandler(repository, workContext);

    const command = new UpdateCustomerCommand(
      'uid-1',
      'cust-1',
      COMPANY,
      BRANCH,
      'Juan Perez Actualizado',
      'DNI',
      '11111111',
    );

    const result = await handler.execute(command);
    expect(result.fullName).toBe('Juan Perez Actualizado');
    expect(repository.update).toHaveBeenCalled();
  });
});
