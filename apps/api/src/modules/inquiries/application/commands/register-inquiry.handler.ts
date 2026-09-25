import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RegisterInquiryCommand } from './register-inquiry.command';

/**
 * CON-P01..P05 (BR-CON-001/003/004/005) - registra la consulta en
 * REGISTRADA con el snapshot de CON-02.
 *
 * Controles (revalidacion PR#7, d7a6124):
 * - ALTO "RBAC pendiente": tras resolver el contexto autorizado se aplica
 *   la politica rol-accion (`REGISTER`, deny-by-default) via MatrixAuthorizationService.
 * - ALTO "aislamiento de cliente": `customerId`, si llega, debe pertenecer
 *   a la MISMA organizacion y empresa del contexto autorizado (antes solo
 *   se comparaba organizacion). 404 si no - no se revela si existe en otra
 *   empresa.
 * - ALTO "brecha contractual con CON-02": se persiste el snapshot
 *   (nacionalidad, destino, dias, prospecto, periodo, personas, fecha de
 *   ingreso). Sin cliente formal, el nombre del prospecto es obligatorio
 *   (CON-P02); la fecha de ingreso al pais solo aplica a EXTRANJERO
 *   (SC-CON-001.03). Ambas reglas se refuerzan tambien con CHECK en la base.
 */
@Injectable()
export class RegisterInquiryHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(command: RegisterInquiryCommand): Promise<InquiryRecord> {
    const { snapshot } = command;
    if (!command.customerId && !snapshot.prospectName?.trim()) {
      throw new BadRequestException({
        code: 'PROSPECT_NAME_REQUIRED',
        detail: 'Sin un cliente formal (customerId), el nombre del prospecto es obligatorio.',
      });
    }
    if (snapshot.countryEntryDate && snapshot.nationality !== 'EXTRANJERO') {
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
    await this.matrixAuth.assertAllowed(context.organizationId, context.role, 'INQUIRY', 'REGISTER');

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
    }

    return this.inquiries.create({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
      customerId: command.customerId,
      channel: command.channel,
      touristUse: command.touristUse,
      prospectName: snapshot.prospectName?.trim() || undefined,
      prospectDocumentType: snapshot.prospectDocumentType,
      prospectDocumentNumber: snapshot.prospectDocumentNumber,
      nationality: snapshot.nationality,
      destination: snapshot.destination,
      estimatedDays: snapshot.estimatedDays,
      travelStartDate: snapshot.travelStartDate,
      partySize: snapshot.partySize,
      countryEntryDate: snapshot.countryEntryDate,
      createdBy: command.firebaseUid,
    });
  }
}
