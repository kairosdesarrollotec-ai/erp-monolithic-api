/**
 * DEC-OPS-FLAGS-001 (Respuestas de Russbel 2026-10-20 #42): un solo criterio para los interruptores de entorno
 * (schedulers y similares). `false|off|0|no` (sin distinguir mayusculas, con trim) = APAGADO; cualquier otro valor
 * = ENCENDIDO; vacio o ausente = el default de cada interruptor.
 */
const OFF_VALUES: ReadonlySet<string> = new Set(['false', 'off', '0', 'no']);

export function isEnvFlagEnabled(raw: string | undefined | null, defaultEnabled = true): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return defaultEnabled;
  return !OFF_VALUES.has(value);
}
