import type { Prisma } from '@prisma/client';

export interface ReservationDepositPolicySnapshot {
  version: number;
  amount: string;
  currency: string;
  /**
   * `null` solo en el valor por defecto que se devuelve cuando la
   * organizacion todavia no tiene ninguna version registrada (ver
   * getCurrent) - no hay una fecha real de vigencia que mostrar porque
   * nunca se registro un cambio.
   */
  effectiveFrom: Date | null;
}

export interface CreateReservationDepositPolicyVersionInput {
  organizationId: string;
  amount: string;
  currency: string;
  createdBy: string;
}

/**
 * ADM-03 (Catalogos y parametros, PANTALLAS-V2-B-SOPORTE.md) - puerto
 * del UNICO parametro versionado real que existe hoy (el monto de
 * reserva, BR-RES-001). El resto de "Catalogos y parametros" que
 * describe el contrato UX (tarifas, plantillas de contrato, formatos)
 * no tiene todavia ningun dato ni consumidor real en el backend - se
 * agrega cuando exista (ver Decision Log / plan de trabajo del Project
 * KAIROS).
 */
export abstract class ReservationDepositPolicyPort {
  /**
   * Version vigente para la organizacion (la de mayor numero de
   * version). Si la organizacion todavia no tiene ninguna fila (nunca
   * uso ADM-03 para cambiarla), devuelve el valor por defecto histórico
   * documentado en reservation-deposit-policy.ts (S/300, version 1) -
   * ninguna reserva existente cambia de monto sin que un admin lo pida
   * explicitamente en ADM-03.
   */
  abstract getCurrent(organizationId: string): Promise<ReservationDepositPolicySnapshot>;

  /** Historial completo, mas reciente primero (contrato ADM-03 punto 11). */
  abstract listHistory(organizationId: string): Promise<ReservationDepositPolicySnapshot[]>;

  /**
   * Inserta una version nueva (nunca edita/borra una existente). `tx`
   * opcional para participar de la misma transaccion que la auditoria
   * del cambio (mismo criterio que el resto del backend).
   */
  abstract createVersion(
    input: CreateReservationDepositPolicyVersionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDepositPolicySnapshot>;
}
