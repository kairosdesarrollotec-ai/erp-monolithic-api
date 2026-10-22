import { isEnvFlagEnabled } from './env-flag';

describe('isEnvFlagEnabled (DEC-OPS-FLAGS-001)', () => {
  it.each(['false', 'off', '0', 'no', 'FALSE', 'Off', ' No ', '  0  '])('%p = apagado', (v) => {
    expect(isEnvFlagEnabled(v)).toBe(false);
    expect(isEnvFlagEnabled(v, false)).toBe(false);
  });

  it.each(['true', 'on', '1', 'yes', 'si', 'cualquier cosa'])('%p = encendido', (v) => {
    expect(isEnvFlagEnabled(v)).toBe(true);
    expect(isEnvFlagEnabled(v, false)).toBe(true);
  });

  it('vacio, solo espacios o ausente respetan el default de cada interruptor', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(isEnvFlagEnabled(v)).toBe(true);
      expect(isEnvFlagEnabled(v, true)).toBe(true);
      expect(isEnvFlagEnabled(v, false)).toBe(false);
    }
  });
});
