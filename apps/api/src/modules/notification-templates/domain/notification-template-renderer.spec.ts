import { renderNotificationTemplate } from './notification-template-renderer';

describe('renderNotificationTemplate', () => {
  it('sustituye variables presentes en el mapa', () => {
    expect(renderNotificationTemplate('Hola {nombre}, tu reserva es el {fecha}', { nombre: 'Ana', fecha: '25/09' })).toBe(
      'Hola Ana, tu reserva es el 25/09',
    );
  });

  it('deja intacta una variable que no esta en el mapa (dato no disponible)', () => {
    expect(renderNotificationTemplate('Hola {nombre}', {})).toBe('Hola {nombre}');
  });

  it('texto sin variables se devuelve igual', () => {
    expect(renderNotificationTemplate('Texto fijo', {})).toBe('Texto fijo');
  });
});
