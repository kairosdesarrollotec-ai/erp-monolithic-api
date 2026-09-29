import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { CustomerDocumentAlreadyExistsError } from '../../domain/customer-errors';
import { UpdateCustomerCommand } from './update-customer.command';
import { Customer } from '../../domain/customer';

@Injectable()
export class UpdateCustomerHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: UpdateCustomerCommand): Promise<Customer> {
    if (command.countryEntryDate && command.nationality !== 'EXTRANJERO') {
      throw new BadRequestException({
        code: 'COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS',
        detail: 'La fecha de ingreso al país solo aplica a clientes extranjeros.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
    };

    const existingCustomer = await this.customers.findById(command.customerId, scope);

    if (!existingCustomer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        detail: `El cliente con ID ${command.customerId} no fue encontrado en esta empresa.`,
      });
    }

    const documentType = command.documentType.trim().toUpperCase();
    const documentNumber = command.documentNumber.trim();

    const documentOwner = await this.customers.findByDocument(documentType, documentNumber, scope);

    if (documentOwner && documentOwner.id !== command.customerId) {
      throw new CustomerDocumentAlreadyExistsError(documentType, documentNumber);
    }

    return this.customers.update(command.customerId, scope, {
      fullName: command.fullName.trim(),
      documentType,
      documentNumber,
      nationality: command.nationality,
      countryEntryDate: command.countryEntryDate,
      email: command.email?.trim().toLowerCase() || null,
      phone: command.phone?.trim() || null,
      address: command.address?.trim() || null,
    });
  }
}
