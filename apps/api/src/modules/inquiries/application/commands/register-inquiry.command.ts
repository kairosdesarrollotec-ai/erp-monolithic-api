import { InquiryChannel } from '../../domain/inquiry-channel';
import { InquiryNationality } from '../../domain/inquiry-nationality';

/**
 * CONFLICT-CON-002 (resuelto): la identidad del prospecto se separa en
 * `ProspectInput`. Cuando no llega `customerId`, el handler crea primero
 * el Customer con estos datos y usa el id resultante.
 */
export interface ProspectInput {
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality: InquiryNationality;
  countryEntryDate?: Date;
}

/**
 * Contexto del viaje capturado en CON-02 (DAT-CON-003).
 * Ya no incluye identidad del prospecto (esa va en ProspectInput / Customer).
 */
export interface RegisterInquirySnapshot {
  destination: string;
  estimatedDays: number;
  travelStartDate?: Date;
  partySize?: number;
}

export class RegisterInquiryCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly channel: InquiryChannel,
    public readonly touristUse: boolean,
    public readonly snapshot: RegisterInquirySnapshot,
    public readonly customerId?: string,
    public readonly prospect?: ProspectInput,
  ) {}
}
