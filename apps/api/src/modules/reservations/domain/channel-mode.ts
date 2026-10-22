import { ChannelModeMismatchError } from './reservation-errors';

/** TDD-RES-001.md seccion 7.2 (BR-RES-005). */
export type ChannelMode = 'PRESENCIAL' | 'VIRTUAL';

export const CUSTOMER_LOCATIONS = ['AYACUCHO', 'FUERA_DE_AYACUCHO'] as const;
export type CustomerLocation = (typeof CUSTOMER_LOCATIONS)[number];

/**
 * BR-RES-005 / SC-RES-007 (PEND-08, PROPUESTO): valida la modalidad contra lo declarado por el front. Ambos datos son
 * OPCIONALES por compatibilidad (omitidos = no se valida): PRESENCIAL con `canComeToOffice=false` o con ubicacion
 * FUERA_DE_AYACUCHO se rechaza (422 CHANNEL_MODE_MISMATCH). VIRTUAL siempre es valida (el cliente puede preferirla).
 */
export function assertChannelModeCoherent(
  channelMode: ChannelMode,
  canComeToOffice?: boolean,
  customerLocation?: CustomerLocation,
): void {
  if (channelMode !== 'PRESENCIAL') return;
  if (canComeToOffice === false || customerLocation === 'FUERA_DE_AYACUCHO') {
    throw new ChannelModeMismatchError();
  }
}
