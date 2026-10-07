import {
  LocalStorageTokenError,
  signLocalStorageToken,
  verifyLocalStorageToken,
} from './local-storage-token';

const SECRET = 'test-secret';
const payload = { key: 'a/b.jpg', action: 'write' as const, contentType: 'image/jpeg', exp: 2_000 };

describe('local storage token', () => {
  it('firma y verifica un token válido', () => {
    const token = signLocalStorageToken(payload, SECRET);
    expect(verifyLocalStorageToken(token, SECRET, 1_000)).toEqual(payload);
  });

  it('rechaza un token expirado', () => {
    const token = signLocalStorageToken(payload, SECRET);
    expect(() => verifyLocalStorageToken(token, SECRET, 2_000)).toThrow(LocalStorageTokenError);
    try {
      verifyLocalStorageToken(token, SECRET, 5_000);
    } catch (e) {
      expect((e as LocalStorageTokenError).reason).toBe('expired');
    }
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = signLocalStorageToken(payload, 'otro');
    expect(() => verifyLocalStorageToken(token, SECRET, 1_000)).toThrow(/bad_signature/);
  });

  it('rechaza un payload manipulado', () => {
    const token = signLocalStorageToken(payload, SECRET);
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, key: '../../etc/passwd' })).toString('base64url');
    expect(() => verifyLocalStorageToken(`${forged}.${sig}`, SECRET, 1_000)).toThrow(/bad_signature/);
  });

  it('rechaza tokens malformados', () => {
    expect(() => verifyLocalStorageToken('abc', SECRET)).toThrow(/malformed/);
    expect(() => verifyLocalStorageToken('', SECRET)).toThrow(/malformed/);
    expect(() => verifyLocalStorageToken('a.b.c', SECRET)).toThrow(/malformed/);
  });
});
