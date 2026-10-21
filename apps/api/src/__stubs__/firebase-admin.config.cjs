/* global module */
// Stub for src/config/firebase-admin.config.ts used in Jest unit tests.
// jest.mock() in specs overrides initFirebaseAdmin with jest.fn() via factory.
// This file only needs to exist for moduleNameMapper path resolution.
function initFirebaseAdmin() {}
module.exports = { initFirebaseAdmin };
