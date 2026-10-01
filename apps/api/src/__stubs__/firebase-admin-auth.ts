import { jest } from '@jest/globals';
// Stub for firebase-admin/auth used in Jest unit tests via moduleNameMapper.
// Exports a jest.fn() so specs can call mockReturnValue without jest.mock().
export const getAuth = jest.fn();
