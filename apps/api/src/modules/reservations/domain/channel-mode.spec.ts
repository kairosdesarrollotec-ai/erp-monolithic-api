import { assertChannelModeCoherent } from './channel-mode';

describe('assertChannelModeCoherent (PEND-08, BR-RES-005 / SC-RES-007)', () => {
  it('PRESENCIAL con cliente que puede acercarse en Ayacucho es valida', () => {
    expect(() => assertChannelModeCoherent('PRESENCIAL', true, 'AYACUCHO')).not.toThrow();
  });

  it('PRESENCIAL sin datos de ubicacion (compatibilidad) no se valida', () => {
    expect(() => assertChannelModeCoherent('PRESENCIAL')).not.toThrow();
  });

  it('PRESENCIAL con canComeToOffice=false -> 422 CHANNEL_MODE_MISMATCH', () => {
    expect(() => assertChannelModeCoherent('PRESENCIAL', false)).toThrow(expect.objectContaining({ code: 'CHANNEL_MODE_MISMATCH', httpStatus: 422 }));
  });

  it('PRESENCIAL con cliente fuera de Ayacucho -> 422 CHANNEL_MODE_MISMATCH', () => {
    expect(() => assertChannelModeCoherent('PRESENCIAL', true, 'FUERA_DE_AYACUCHO')).toThrow(expect.objectContaining({ code: 'CHANNEL_MODE_MISMATCH' }));
  });

  it('VIRTUAL siempre es valida', () => {
    expect(() => assertChannelModeCoherent('VIRTUAL', false, 'FUERA_DE_AYACUCHO')).not.toThrow();
    expect(() => assertChannelModeCoherent('VIRTUAL', true, 'AYACUCHO')).not.toThrow();
  });
});
