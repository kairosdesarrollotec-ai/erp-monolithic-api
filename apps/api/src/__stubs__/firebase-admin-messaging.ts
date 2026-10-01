import { jest } from '@jest/globals';
// Stub for firebase-admin/messaging used in Jest unit tests via moduleNameMapper.
// Exports a jest.fn() so specs can call mockReturnValue without jest.mock().
export const getMessaging = jest.fn();
