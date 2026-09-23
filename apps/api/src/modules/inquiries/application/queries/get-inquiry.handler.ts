import { Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertInquiryRoleAllowed } from '../policies/inquiry-role-policy';
import { GetInquiryQuery } from './get-inquiry.query';

/**
 * CON-04 - detalle de una consulta (con interactions/quotations). Scope
 * completo (organizacion + empresa + sede) en la busqueda: una consulta de
 * otra sede o empresa responde 404. Politica rol-accion `READ`
 * (revalidacion PR#7).
 */
@Injectable()
export class GetInquiryHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: GetInquiryQuery): Promise<InquiryRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    assertInquiryRoleAllowed(context.role, 'READ');

    const inquiry = await this.inquiries.findById(query.id, {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    });
    if (!inquiry) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    return inquiry;
  }
}
