import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerRepositoryPort } from '../ports/customer-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertCustomerWrite } from '../policies/customer-role.policy';
import { CustomerDocumentAlreadyExistsError } from '../../domain/customer-errors';
import { CreateCustomerCommand } from './create-customer.command';
import { Customer } from '../../domain/customer';

@Injectable()
export class CreateCustomerHandler {
  constructor(
    private readonly customers: CustomerRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: CreateCustomerCommand): Promise<Customer> {
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

    assertCustomerWrite(context.roleKey);

    const existing = await this.customers.findByDocument(
      command.documentType.trim().toUpperCase(),
      command.documentNumber.trim(),
      {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
      },
    );

    if (existing) {
      throw new CustomerDocumentAlreadyExistsError(command.documentType, command.documentNumber);
    }

    try {
      return await this.customers.create({
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        fullName: command.fullName.trim(),
        documentType: command.documentType.trim().toUpperCase(),
        documentNumber: command.documentNumber.trim(),
        nationality: command.nationality,
        countryEntryDate: command.countryEntryDate,
        email: command.email?.trim().toLowerCase() || null,
        phone: command.phone?.trim() || null,
        address: command.address?.trim() || null,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new CustomerDocumentAlreadyExistsError(command.documentType, command.documentNumber);
      }
      throw err;
    }
  }
}
