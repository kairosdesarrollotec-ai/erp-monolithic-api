import { INQUIRY_LIST_DEFAULT_LIMIT } from '../../domain/inquiry-pagination';
import { InquiryStatus } from '../../domain/inquiry-status';
import { InquiryChannel } from '../../domain/inquiry-channel';

/**
 * Hallazgo critico de revision PR#7 ("la bandeja de consultas esta
 * rota"): el controller anterior construia esta query pasando
 * `query.companyId` tambien como `branchId`, vaciando siempre CON-01
 * (ningun branchId real coincide con un companyId). `branchId` ahora es
 * su propio parametro obligatorio. Se agrega ademas paginacion por
 * cursor (createdAt+id, ver InquiryRepositoryPort.list).
 */
export class ListInquiriesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: InquiryStatus,
    public readonly channel?: InquiryChannel,
    public readonly customerId?: string,
    public readonly createdFrom?: Date,
    public readonly createdTo?: Date,
    public readonly limit: number = INQUIRY_LIST_DEFAULT_LIMIT,
    public readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
