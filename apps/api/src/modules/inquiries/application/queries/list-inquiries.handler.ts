import { BadRequestException, Injectable } from '@nestjs/common';
import { InquiryRepositoryPort, InquirySummaryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { INQUIRY_LIST_MAX_LIMIT } from '../../domain/inquiry-pagination';
import { ListInquiriesQuery } from './list-inquiries.query';

/**
 * CON-01 - bandeja de consultas (filtros cliente/canal/estado/fecha).
 *
 * Revalidacion PR#7 (d7a6124):
 * - ALTO "RBAC": politica `READ` (Front-office, Gerencia, Auditoria,
 *   Administracion - PANTALLAS-V3-B-CONSULTA.md CON-01 punto 3).
 * - MEDIO "listado/paginacion": proyeccion de resumen (sin historial),
 *   limite maximo 100 (igual que OpenAPI) y keyset real createdAt/id.
 *
 * Rango de fechas: inclusivo en ambos extremos, ISO-8601 (formato exigido
 * por el DTO); `createdFrom` debe ser <= `createdTo`.
 */
@Injectable()
export class ListInquiriesHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  async execute(query: ListInquiriesQuery): Promise<InquirySummaryRecord[]> {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > INQUIRY_LIST_MAX_LIMIT) {
      throw new BadRequestException({
        code: 'INVALID_LIMIT',
        detail: `limit debe ser un entero entre 1 y ${INQUIRY_LIST_MAX_LIMIT}.`,
      });
    }
    if (query.createdFrom && query.createdTo && query.createdFrom > query.createdTo) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        detail: 'createdFrom debe ser anterior o igual a createdTo.',
      });
    }

    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'READ', { companyId: context.companyId, branchId: context.branchId });

    return this.inquiries.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
      status: query.status,
      channel: query.channel,
      customerId: query.customerId,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
