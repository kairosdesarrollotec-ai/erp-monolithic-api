// Workaround: --experimental-vm-modules does not automatically expose the
// jest object as a global inside ts-jest ESM modules. This file is loaded via
// setupFilesAfterFramework and assigns jest to globalThis so that fixture and
// helper files can call jest.fn() / jest.spyOn() without an explicit import.
import { jest as jestObj } from '@jest/globals';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = jestObj;
