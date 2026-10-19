import {
  holderTypeFromContractVariant,
  holderTypeFromDocumentType,
  type HolderType,
} from './contract-variant';
import { RentalHolderTypeMismatchError, RentalHolderTypeRequiredError } from './rental-errors';

/**
 * Tipo de titular de un alquiler: contrato formalizado > tipo de documento del titular (RUC -> LEGAL,
 * DNI -> NATURAL; respuesta de Fiorella 16-oct-2026) > `holderType` explicito del request (solo respaldo).
 */
export function resolveRentalHolderType(input: {
  contractVariant: string | null | undefined;
  titularDocumentType: string | null | undefined;
  requested: HolderType | undefined;
}): HolderType {
  const derived = holderTypeFromContractVariant(input.contractVariant) ?? holderTypeFromDocumentType(input.titularDocumentType);
  if (derived && input.requested && derived !== input.requested) {
    throw new RentalHolderTypeMismatchError(derived);
  }
  const resolved = derived ?? input.requested;
  if (!resolved) throw new RentalHolderTypeRequiredError();
  return resolved;
}
