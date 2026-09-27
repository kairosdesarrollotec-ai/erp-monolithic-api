import { ForbiddenException } from '@nestjs/common';
import { WORKER_ROLES } from '../../../users/domain/worker-role';
import { InquiryAction, assertInquiryRoleAllowed, isInquiryRoleAllowed } from './inquiry-role-policy';

/**
 * Matriz completa (7 roles x 5 acciones) - deny-by-default. Fuente:
 * PANTALLAS-V3-B-CONSULTA.md punto 3 de CON-01..CON-04.
 */
const EXPECTED: Record<InquiryAction, string[]> = {
  READ: ['ADMINISTRACION', 'AUDITORIA', 'FRONT_OFFICE', 'GERENCIA'],
  REGISTER: ['FRONT_OFFICE'],
  QUOTE: ['FRONT_OFFICE'],
  CLOSE: ['FRONT_OFFICE'],
  CONVERT_TO_RESERVATION: ['FRONT_OFFICE'],
};

describe('inquiry-role-policy', () => {
  for (const [action, allowed] of Object.entries(EXPECTED) as [InquiryAction, string[]][]) {
    it(`${action}: permite exactamente [${allowed.join(', ')}] (+ PLATFORM_ADMIN que siempre pasa) y deniega el resto`, () => {
      // PLATFORM_ADMIN tiene bypass incondicional en la politica (no es una entrada de la matriz).
      const granted = WORKER_ROLES.filter((role) => role !== 'PLATFORM_ADMIN' && isInquiryRoleAllowed(role, action));
      expect(granted).toEqual(allowed);
    });
  }

  it('deniega por defecto una accion desconocida', () => {
    expect(isInquiryRoleAllowed('FRONT_OFFICE', 'DELETE' as InquiryAction)).toBe(false);
  });

  it('assertInquiryRoleAllowed lanza 403 ROLE_NOT_ALLOWED', () => {
    let error: unknown;
    try {
      assertInquiryRoleAllowed('CAMPO', 'READ');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual(expect.objectContaining({ code: 'ROLE_NOT_ALLOWED' }));
  });
});
