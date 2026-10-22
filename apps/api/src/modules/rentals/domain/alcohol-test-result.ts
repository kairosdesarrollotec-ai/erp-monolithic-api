/**
 * TDD-03-alquiler.md seccion 8.2 y BR-ALQ-005.
 * Prueba de alcolímetro de tolerancia cero (0.00 g/l).
 */
export type AlcoholTestResult = 'FAVORABLE' | 'DESFAVORABLE' | 'RECHAZADO';

/** ENTREGA-02 (Respuestas 2026-10-20 #10): zona fija de la foto de la prueba de alcolimetro. */
export const RENTAL_ALCOHOL_TEST_EVIDENCE_ZONE = 'ALCOHOL_TEST';

/** DESFAVORABLE y RECHAZADO (= desfavorable) exigen la foto de la prueba. */
export function alcoholTestRequiresPhoto(result: AlcoholTestResult): boolean {
  return result === 'DESFAVORABLE' || result === 'RECHAZADO';
}

export function isAlcoholTestPassing(result: AlcoholTestResult): boolean {
  return result === 'FAVORABLE';
}
