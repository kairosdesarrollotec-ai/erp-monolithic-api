import { HolderType } from '../../../domain/contract-variant';

export interface ContractTemplateSelectionResponse {
  rentalId: string;
  variant: { holderType: HolderType; withDriver: boolean } | null;
  requestedType: string;
  fallbackUsed: boolean;
  template: {
    id: string;
    type: string;
    name: string;
    version: number | null;
    effectiveFrom: string | null;
  } | null;
}
