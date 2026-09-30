// CJS stub for jose (ESM-only package) used in Jest unit tests.
// jwks-rsa (CJS) requires jose for key import/export; these stubs are
// sufficient for NestJS module compilation tests where no JWT is verified.
module.exports = {
  importJWK: async () => ({}),
  exportSPKI: async () => (''),
  createLocalJWKSet: () => async () => ({}),
  jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
  importX509: async () => ({}),
  exportPKCS8: async () => (''),
};
