/**
 * BR-RES-001 (BDD-RES-001.md): el monto de reserva vigente es un
 * parametro versionado, no una constante fija en el dominio.
 *
 * PROVISIONAL (HU-27/RES, docs/decision-log.md PROP-005): no existe
 * todavia una tabla de parametros versionados real - este modulo lee un
 * unico valor vigente fijo en codigo (S/300, version 1), que reproduce
 * el "valor vigente observado" documentado en BDD-RES-001 DAT-RES-003.
 * Se migra a una tabla de politicas versionadas cuando el negocio la
 * defina formalmente.
 */
export interface ReservationDepositPolicy {
  amount: string; // Decimal como string, ver Money value object del TDD
  currency: string;
  version: number;
}

export const CURRENT_RESERVATION_DEPOSIT_POLICY: ReservationDepositPolicy = {
  amount: '300.00',
  currency: 'PEN',
  version: 1,
};
