/**
 * Hallazgo ALTO de revalidacion PR#7 ("conversion acepta cotizaciones
 * vencidas" - "con reloj inyectable"): los handlers que dependen de la
 * hora actual (vigencia de cotizaciones, fecha de inicio de la reserva)
 * la obtienen de este puerto, nunca de `Date.now()` directo, para que las
 * pruebas puedan fijar el instante y cubrir expiraciones de forma
 * determinista.
 */
export abstract class ClockPort {
  abstract now(): Date;
}

export class SystemClock extends ClockPort {
  now(): Date {
    return new Date();
  }
}
