import { InquiryRecord, InquirySummaryRecord } from '../../application/ports/inquiry-repository.port';
import { InquiryResponse, InquirySummaryResponse } from './dto/inquiry.response';

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toInquirySummaryResponse(record: InquirySummaryRecord): InquirySummaryResponse {
  return {
    id: record.id,
    companyId: record.operatingCompanyId,
    branchId: record.branchId,
    status: record.status,
    channel: record.channel,
    touristUse: record.touristUse,
    customerId: record.customerId,
    destination: record.destination,
    estimatedDays: record.estimatedDays,
    travelStartDate: toDateOnly(record.travelStartDate),
    partySize: record.partySize,
    dataOrigin: record.dataOrigin,
    closedReason: record.closedReason,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toInquiryResponse(record: InquiryRecord): InquiryResponse {
  return {
    ...toInquirySummaryResponse(record),
    interactions: record.interactions.map((interaction) => ({
      id: interaction.id,
      channel: interaction.channel,
      occurredAt: interaction.occurredAt.toISOString(),
      outcome: interaction.outcome,
      note: interaction.note,
    })),
    quotations: record.quotations.map((quotation) => ({
      id: quotation.id,
      vehicleId: quotation.vehicleId,
      rateCardVersionId: quotation.rateCardVersionId,
      destination: quotation.destination,
      estimatedDays: quotation.estimatedDays,
      amount: quotation.amount,
      currency: quotation.currency,
      validUntil: quotation.validUntil.toISOString(),
      createdAt: quotation.createdAt.toISOString(),
    })),
  };
}
