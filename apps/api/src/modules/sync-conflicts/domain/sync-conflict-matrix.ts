import { SyncPaymentOnlineOnlyError, SyncResolverNotSupportedError } from './sync-errors';
import type { SyncFieldDataType, SyncScalar } from './sync-types';

/**
 * Matriz de conflicto por tipo de dato - SDD-KAIROS-TRANSVERSAL 17.4 (SAD-KAIROS-MVP-001 14.3), transcrita sin
 * agregar reglas:
 *
 * | Tipo de dato                          | Regla                                                              |
 * | Disponibilidad, Reserva, estado veh.  | Prevalece siempre el servidor - sin override manual posible        |
 * | Pago                                  | Exclusivamente online - la fuente financiera siempre prevalece     |
 * | Checklist                             | Campos distintos se combinan; el MISMO campo por dos actores ->    |
 * |                                       | requiere resolucion de un supervisor                               |
 * | Evidencias                            | Aditivas - nunca se sobrescriben silenciosamente                   |
 * | Datos de empleados                    | Resuelve Recursos Humanos                                          |
 * | Borrados criticos                     | Resuelve el Data Owner                                             |
 */
export type SyncStrategy =
  | 'SERVER_WINS'
  | 'ONLINE_ONLY'
  | 'FIELD_MERGE'
  | 'ADDITIVE'
  | 'HR_RESOLVES'
  | 'DATA_OWNER_RESOLVES';

export interface SyncPolicy {
  strategy: SyncStrategy;
  /** Quien resuelve cuando hay choque; NONE = no hay resolucion manual (el servidor/online decide). */
  resolver: 'NONE' | 'SUPERVISOR' | 'HR' | 'DATA_OWNER';
  manualOverrideAllowed: boolean;
}

export const SYNC_CONFLICT_MATRIX: Readonly<Record<SyncFieldDataType | 'EVIDENCE', SyncPolicy>> = {
  AVAILABILITY: { strategy: 'SERVER_WINS', resolver: 'NONE', manualOverrideAllowed: false },
  RESERVATION: { strategy: 'SERVER_WINS', resolver: 'NONE', manualOverrideAllowed: false },
  VEHICLE_STATE: { strategy: 'SERVER_WINS', resolver: 'NONE', manualOverrideAllowed: false },
  PAYMENT: { strategy: 'ONLINE_ONLY', resolver: 'NONE', manualOverrideAllowed: false },
  CHECKLIST: { strategy: 'FIELD_MERGE', resolver: 'SUPERVISOR', manualOverrideAllowed: true },
  EVIDENCE: { strategy: 'ADDITIVE', resolver: 'SUPERVISOR', manualOverrideAllowed: true },
  EMPLOYEE: { strategy: 'HR_RESOLVES', resolver: 'HR', manualOverrideAllowed: false },
  CRITICAL_DELETE: { strategy: 'DATA_OWNER_RESOLVES', resolver: 'DATA_OWNER', manualOverrideAllowed: false },
};

export function policyFor(dataType: SyncFieldDataType | 'EVIDENCE'): SyncPolicy {
  return SYNC_CONFLICT_MATRIX[dataType];
}

export interface IncomingField {
  key: string;
  dataType: SyncFieldDataType;
  value: SyncScalar;
  baseRev: number;
  editedAt: string;
}

export interface DiscardedField {
  key: string;
  dataType: SyncFieldDataType;
  code: 'SERVER_PREVAILS';
  detail: string;
}

/**
 * Separa lo que entra al merge de checklist de lo que el servidor descarta por matriz. Lanza si el lote contiene
 * un dato que NUNCA debio viajar offline (pago) o que resuelve otro actor (RR.HH. / Data Owner).
 * Nada de esto crea un conflicto: "prevalece el servidor, sin override manual" (el dispositivo solo recibe el aviso).
 */
export function classifyIncomingFields(fields: readonly IncomingField[]): {
  checklist: IncomingField[];
  discarded: DiscardedField[];
} {
  const checklist: IncomingField[] = [];
  const discarded: DiscardedField[] = [];
  for (const field of fields) {
    const policy = policyFor(field.dataType);
    switch (policy.strategy) {
      case 'ONLINE_ONLY':
        throw new SyncPaymentOnlineOnlyError();
      case 'HR_RESOLVES':
        throw new SyncResolverNotSupportedError('datos de empleados', 'Recursos Humanos');
      case 'DATA_OWNER_RESOLVES':
        throw new SyncResolverNotSupportedError('borrados criticos', 'el Data Owner');
      case 'SERVER_WINS':
        discarded.push({
          key: field.key,
          dataType: field.dataType,
          code: 'SERVER_PREVAILS',
          detail: 'Disponibilidad, reserva y estado del vehiculo: prevalece el servidor, sin override manual.',
        });
        break;
      default:
        checklist.push(field);
    }
  }
  return { checklist, discarded };
}
