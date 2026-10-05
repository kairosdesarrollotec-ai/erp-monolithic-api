import { resolveDamageAssessment } from './damage-assessment';
import {
  InvalidAestheticDamageError,
  TechnicalDamageRequiresExternalReportError,
  UnknownCosmeticZoneError,
} from './return-errors';

describe('resolveDamageAssessment (BR-DEV-006)', () => {
  it('estético: el monto sale siempre del tarifario por paño y se ignora el monto enviado por el cliente', () => {
    const result = resolveDamageAssessment({
      origin: 'AESTHETIC',
      severity: 'LEVE',
      damagedZone: 'puerta_lateral_derecha',
      estimatedAmount: 1,
    });
    expect(result).toMatchObject({
      origin: 'AESTHETIC',
      damagedZone: 'PUERTA_LATERAL_DERECHA',
      estimatedAmount: 180,
      externalReportReference: null,
    });
  });

  it('estético: zona desconocida o ausente -> UnknownCosmeticZoneError', () => {
    expect(() => resolveDamageAssessment({ origin: 'AESTHETIC', severity: 'LEVE', damagedZone: 'MOTOR' })).toThrow(
      UnknownCosmeticZoneError,
    );
    expect(() => resolveDamageAssessment({ origin: 'AESTHETIC', severity: 'LEVE' })).toThrow(UnknownCosmeticZoneError);
  });

  it('estético con referencia a informe externo -> InvalidAestheticDamageError', () => {
    expect(() =>
      resolveDamageAssessment({
        origin: 'AESTHETIC',
        severity: 'LEVE',
        damagedZone: 'CAPOT',
        externalReportReference: 'INFORME-1',
      }),
    ).toThrow(InvalidAestheticDamageError);
  });

  it('técnico sin referencia externa (o en blanco) -> TechnicalDamageRequiresExternalReportError', () => {
    expect(() => resolveDamageAssessment({ origin: 'TECHNICAL', severity: 'MODERADO' })).toThrow(
      TechnicalDamageRequiresExternalReportError,
    );
    expect(() =>
      resolveDamageAssessment({ origin: 'TECHNICAL', severity: 'MODERADO', externalReportReference: '   ' }),
    ).toThrow(TechnicalDamageRequiresExternalReportError);
  });

  it('técnico: nunca calcula monto; registra el monto manual del informe o lo deja pendiente (null)', () => {
    const withAmount = resolveDamageAssessment({
      origin: 'TECHNICAL',
      severity: 'GRAVE',
      externalReportReference: ' INFORME-MOTRIX-2026-0847 ',
      estimatedAmount: 850,
    });
    expect(withAmount).toMatchObject({
      origin: 'TECHNICAL',
      estimatedAmount: 850,
      externalReportReference: 'INFORME-MOTRIX-2026-0847',
    });

    const pending = resolveDamageAssessment({
      origin: 'TECHNICAL',
      severity: 'LEVE',
      damagedZone: 'CAPOT',
      externalReportReference: 'INFORME-2',
    });
    expect(pending.estimatedAmount).toBeNull();
  });
});
