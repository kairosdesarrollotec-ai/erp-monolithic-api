import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from './admin.controller';
import {
  RECENT_AUTH_SECONDS_KEY,
  RecentAuthGuard,
} from '../../../users/infrastructure/auth/recent-auth.guard';

/**
 * ADM-02 contrato punto 10 / SEC-F4: guardar la matriz exige MFA de los ultimos
 * 5 minutos; el resto de rutas de Administracion no cambia.
 */
describe('AdminController - MFA reciente al guardar la matriz (ADM-02)', () => {
  const proto = AdminController.prototype as unknown as Record<string, () => unknown>;

  it('POST /admin/permissions usa RecentAuthGuard con ventana de 300 s', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, proto.savePermissions) as unknown[];
    expect(guards).toContain(RecentAuthGuard);
    expect(Reflect.getMetadata(RECENT_AUTH_SECONDS_KEY, proto.savePermissions)).toBe(300);
  });

  it('GET /admin/permissions (lectura) no exige MFA reciente', () => {
    expect(Reflect.getMetadata(RECENT_AUTH_SECONDS_KEY, proto.permissions)).toBeUndefined();
  });
});
