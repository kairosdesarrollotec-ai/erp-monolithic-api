import { Module, Injectable, type DynamicModule } from '@nestjs/common';

// Stub for @nestjs/throttler used in Jest unit tests via moduleNameMapper.
// @nestjs/throttler ships CJS that requires @nestjs/common (ESM in v12), which
// triggers a "Must use import to load ES Module" error under --experimental-vm-modules.
// This stub exports NestJS-compatible classes so AppModule and module-compilation
// specs can compile without the CJS→ESM cycle.

@Module({})
class ThrottlerModuleStub {
  static forRoot(_options?: unknown): DynamicModule {
    return { module: ThrottlerModuleStub, providers: [], exports: [] };
  }
}

@Injectable()
class ThrottlerGuardStub {
  canActivate() {
    return true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Throttle = (_options?: unknown) => (_target: any, _key?: string, _descriptor?: PropertyDescriptor) => _descriptor;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SkipThrottle = (_options?: unknown) => (_target: any, _key?: string, _descriptor?: PropertyDescriptor) => _descriptor;

export { ThrottlerModuleStub as ThrottlerModule, ThrottlerGuardStub as ThrottlerGuard, Throttle, SkipThrottle };
