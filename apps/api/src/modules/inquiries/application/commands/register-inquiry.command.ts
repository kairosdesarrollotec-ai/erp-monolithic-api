import { InquiryChannel } from '../../domain/inquiry-channel';
import { InquiryNationality } from '../../domain/inquiry-nationality';

/**
 * CON-02 (PANTALLAS-V3-B-CONSULTA.md punto 6) - canal, cliente (formal o
 * prospecto: nombre, documento, nacionalidad), uso, destino, periodo,
 * personas. Hallazgo ALTO de revalidacion PR#7 ("brecha contractual con
 * CON-02"): antes solo viajaban canal/cliente/uso y el resto se perdia.
 */
export interface RegisterInquirySnapshot {
  nationality: InquiryNationality;
  destination: string;
  estimatedDays: number;
  prospectName?: string;
  prospectDocumentType?: string;
  prospectDocumentNumber?: string;
  travelStartDate?: Date;
  partySize?: number;
  countryEntryDate?: Date;
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
  ) {}
}
