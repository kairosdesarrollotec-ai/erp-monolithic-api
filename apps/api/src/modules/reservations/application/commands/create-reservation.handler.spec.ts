import { ForbiddenException } from '@nestjs/common';
import { CreateReservationHandler } from './create-reservation.handler';
import { CreateReservationCommand } from './create-reservation.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

/**
 * Russbel 22-oct-2026 (decision 1; DEC-CON-001-FINAL, BR-CON-003): `POST /reservations` ya no crea nada. Consulta es el
 * unico punto de entrada: sin inquiryId -> 422 INQUIRY_REQUIRED; con inquiryId -> 409 INQUIRY_CONVERSION_REQUIRED.
 */
describe('CreateReservationHandler (shim: Consulta es el unico punto de entrada)', () => {
  function build(role = 'FRONT_OFFICE', forbiddenContext = false) {
    const workContext = {
      authorize: forbiddenContext
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = {
      assertAllowed: jest.fn().mockImplementation(async (_orgId, r, _mod, action) => {
        assertReservationRoleAllowed(roleKeyOfTestRoleId(r), action);
      }),
      isAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;
    return { handler: new CreateReservationHandler(workContext, matrixAuth), workContext, matrixAuth };
  }

  it('sin inquiryId -> 422 INQUIRY_REQUIRED', async () => {
    const { handler } = build();

    await expect(handler.execute(new CreateReservationCommand('uid-1', 'company-1', 'branch-1'))).rejects.toMatchObject({
      code: 'INQUIRY_REQUIRED',
      httpStatus: 422,
    });
  });

  it('con inquiryId -> 409 INQUIRY_CONVERSION_REQUIRED (permanente) que apunta a convert-to-reservation', async () => {
    const { handler } = build();

    await expect(handler.execute(new CreateReservationCommand('uid-1', 'company-1', 'branch-1', 'inq-1'))).rejects.toMatchObject({
      code: 'INQUIRY_CONVERSION_REQUIRED',
      httpStatus: 409,
      detail: expect.stringContaining('/inquiries/inq-1/commands/convert-to-reservation'),
    });
  });

  it('un rol sin RESERVATION.CREATE recibe 403, no el error de contrato', async () => {
    const { handler } = build('CAMPO');

    await expect(handler.execute(new CreateReservationCommand('uid-1', 'company-1', 'branch-1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('una asignacion de contexto no vigente recibe 403', async () => {
    const { handler } = build('FRONT_OFFICE', true);

    await expect(handler.execute(new CreateReservationCommand('uid-1', 'company-x', 'branch-x'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
