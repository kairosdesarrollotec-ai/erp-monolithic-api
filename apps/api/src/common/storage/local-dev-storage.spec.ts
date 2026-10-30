import { isLocalDevStorageEnabled } from './local-dev-storage';

describe('isLocalDevStorageEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('only enables storage for a loopback HTTP development API', () => {
    process.env.LOCAL_STORAGE_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
    process.env.API_BASE_URL = 'http://localhost:3000';

    expect(isLocalDevStorageEnabled()).toBe(true);
  });

  it.each([
    ['production', 'http://localhost:3000'],
    ['staging', 'http://localhost:3000'],
    ['development', 'https://api.example.test'],
  ])('rejects NODE_ENV=%s and API_BASE_URL=%s', (nodeEnv, baseUrl) => {
    process.env.LOCAL_STORAGE_ENABLED = 'true';
    process.env.NODE_ENV = nodeEnv;
    process.env.API_BASE_URL = baseUrl;

    expect(isLocalDevStorageEnabled()).toBe(false);
  });
});
