/**
 * TDD-03-alquiler.md seccion 8.2 y BR-ALQ-005.
 * Prueba de alcolímetro de tolerancia cero (0.00 g/l).
 */
export type AlcoholTestResult = 'FAVORABLE' | 'DESFAVORABLE' | 'RECHAZADO';

export function isAlcoholTestPassing(result: AlcoholTestResult): boolean {
  return result === 'FAVORABLE';
}
