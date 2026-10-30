import { assertHttpUrl } from './http-url';

describe('assertHttpUrl (R-6)', () => {
  it('acepta http y https y devuelve el texto sin espacios', () => {
    expect(assertHttpUrl(' https://storage.kairos.pe/doc.pdf ')).toBe('https://storage.kairos.pe/doc.pdf');
    expect(assertHttpUrl('http://localhost:9000/x')).toBe('http://localhost:9000/x');
  });

  it.each(['', '   ', 'hola', '/personal/hola', 'javascript:alert(1)', 'ftp://x.pe/a', 'data:text/html;base64,AAAA'])(
    'rechaza %p con INVALID_URL',
    (value) => {
      expect(() => assertHttpUrl(value)).toThrow(expect.objectContaining({ code: 'INVALID_URL' }));
    },
  );

  it('rechaza null y undefined', () => {
    expect(() => assertHttpUrl(null)).toThrow(expect.objectContaining({ code: 'INVALID_URL' }));
    expect(() => assertHttpUrl(undefined)).toThrow(expect.objectContaining({ code: 'INVALID_URL' }));
  });
});
