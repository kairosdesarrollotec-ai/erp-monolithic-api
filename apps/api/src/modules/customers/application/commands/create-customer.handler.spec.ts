import { BadRequestException } from '@nestjs/common';
import { CreateCustomerHandler } from './create-customer.handler';
import { CreateCustomerCommand } from './create-customer.command';
import { CustomerDocumentAlreadyExistsError } from '../../domain/customer-errors';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildCustomer,
  buildCustomerRepository,
  buildWorkContext,
} from '../../testing/customer-test-fixtures';

describe('CreateCustomerHandler', () => {
  it('crea un cliente con datos completos y formato sanitizado', async () => {
    const repository = buildCustomerRepository();
    const workContext = buildWorkContext();
    const handler = new CreateCustomerHandler(repository, workContext);

    const command = new CreateCustomerCommand(
      'uid-1',
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
    expect(repository.findByDocument).toHaveBeenCalledWith('DNI', '70889900', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      fullName: 'Carlos Mendoza',
      documentType: 'DNI',
      documentNumber: '70889900',
      nationality: 'PERUANO',
      countryEntryDate: undefined,
      email: 'carlos.mendoza@gmail.com',
      phone: '987654321',
      address: 'Av. Siempre Viva 123',
    });
    expect(result.fullName).toBe('Carlos Mendoza');
    expect(result.documentType).toBe('DNI');
  });

  it('rechaza countryEntryDate si el cliente no es extranjero', async () => {
    const repository = buildCustomerRepository();
    const workContext = buildWorkContext();
    const handler = new CreateCustomerHandler(repository, workContext);

    const command = new CreateCustomerCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      'Maria Lopez',
      'DNI',
      '44556677',
      'PERUANO',
      new Date('2026-09-01T00:00:00Z'),
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('permite countryEntryDate si la nacionalidad es EXTRANJERO', async () => {
    const repository = buildCustomerRepository();
    const workContext = buildWorkContext();
    const handler = new CreateCustomerHandler(repository, workContext);
    const entryDate = new Date('2026-09-01T00:00:00Z');

    const command = new CreateCustomerCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      'John Smith',
      'PASAPORTE',
      'A12345678',
      'EXTRANJERO',
      entryDate,
    );

    const result = await handler.execute(command);
    expect(result.countryEntryDate).toEqual(entryDate);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nationality: 'EXTRANJERO',
        countryEntryDate: entryDate,
      }),
    );
  });

  it('falla con CustomerDocumentAlreadyExistsError si el documento ya está registrado para la empresa', async () => {
    const existing = buildCustomer({ documentType: 'DNI', documentNumber: '12345678' });
    const repository = buildCustomerRepository();
    repository.findByDocument.mockResolvedValue(existing);

    const workContext = buildWorkContext();
    const handler = new CreateCustomerHandler(repository, workContext);

    const command = new CreateCustomerCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      'Duplicado Perez',
      'DNI',
      '12345678',
    );

    await expect(handler.execute(command)).rejects.toThrow(CustomerDocumentAlreadyExistsError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
