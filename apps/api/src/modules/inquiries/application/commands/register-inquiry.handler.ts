import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RegisterInquiryCommand } from './register-inquiry.command';

/**
 * CON-P01..P05 (BR-CON-001/003/004/005) - registra la consulta en REGISTRADA.
 *
 * CONFLICT-CON-002 (resuelto): la identidad del prospecto se persiste en
 * Customer, no en Inquiry. Flujo:
 *   a) Si llega `customerId` -> valida que pertenezca a la empresa del contexto.
 *   b) Si llega `prospect` (sin customerId) -> crea el Customer primero; el
 *      customerId resultante va en la Inquiry. La fecha de ingreso solo aplica
 *      a EXTRANJERO (SC-CON-001.03).
 *   c) Si no llega ninguno de los dos -> error 400.
 */
@Injectable()
export class RegisterInquiryHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: RegisterInquiryCommand): Promise<InquiryRecord> {
    if (!command.customerId && !command.prospect) {
      throw new BadRequestException({
        code: 'PROSPECT_OR_CUSTOMER_REQUIRED',
        detail: 'Debe indicar un cliente formal (customerId) o los datos del prospecto.',
      });
    }

    if (command.prospect?.countryEntryDate && command.prospect.nationality !== 'EXTRANJERO') {
      throw new BadRequestException({
        code: 'COUNTRY_ENTRY_DATE_ONLY_FOR_FOREIGNERS',
        detail: 'La fecha de ingreso al pais solo aplica a clientes extranjeros.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'REGISTER', { companyId: context.companyId, branchId: context.branchId });

    let customerId: string;

    if (command.customerId) {
      const customer = await this.inquiries.findCustomerById(command.customerId);
      if (
        !customer ||
        customer.organizationId !== context.organizationId ||
        customer.operatingCompanyId !== context.companyId
      ) {
        throw new NotFoundException({
          code: 'CUSTOMER_NOT_FOUND',
          detail: 'El cliente indicado no existe en esta empresa.',
        });
      }
      customerId = customer.id;
    } else {
      const prospect = command.prospect!;
      const created = await this.inquiries.createCustomer({
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
        fullName: prospect.fullName.trim(),
        documentType: prospect.documentType,
        documentNumber: prospect.documentNumber,
        nationality: prospect.nationality,
        countryEntryDate: prospect.countryEntryDate,
      });
      customerId = created.id;
    }

    return this.inquiries.create({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
      customerId,
      channel: command.channel,
      touristUse: command.touristUse,
      destination: command.snapshot.destination,
      estimatedDays: command.snapshot.estimatedDays,
      travelStartDate: command.snapshot.travelStartDate,
      partySize: command.snapshot.partySize,
      isDirtRoad: command.snapshot.isDirtRoad ?? false,
      createdBy: command.firebaseUid,
    });
  }
}
