import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CreateReservationHandler } from './create-reservation.handler';
import { CreateReservationCommand } from './create-reservation.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';

/**
 * Revalidacion PR#7 (hallazgo CRITICO "cardinalidad Inquiry -> Reservation"):
 * `POST /reservations` ya no crea reservas - la unica via es
 * convert-to-reservation (CONFLICT-CON-001). Estos tests fijan que el
 * endpoint conserva autenticacion/contexto/rol y NUNCA persiste.
 */
describe('CreateReservationHandler', () => {
  function buildCommand() {
    return new CreateReservationCommand(
      'uid-1',
      'company-1',
      'branch-1',
      'inq-1',
      'cust-1',
      'veh-1',
      'PRESENCIAL',
      new Date('2026-10-20T14:00:00Z'),
      new Date('2026-10-22T14:00:00Z'),
    );
  }

  function buildWorkContext(result: { role: string } | 'forbidden') {
    return {
      authorize:
        result === 'forbidden'
          ? jest.fn().mockRejectedValue(new ForbiddenException())
          : jest.fn().mockResolvedValue({
              organizationId: 'org-1',
              companyId: 'company-1',
              branchId: 'branch-1',
              role: result.role,
            }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  }

  function buildMatrixAuth(overrides?: { assertAllowed?: jest.Mock }): MatrixAuthorizationService {
    return {
      assertAllowed:
        overrides?.assertAllowed ??
        jest.fn().mockImplementation(async (_orgId, role, _module, action) => {
          assertReservationRoleAllowed(role, action);
        }),
      isAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as MatrixAuthorizationService;
  }

  it('responde 409 INQUIRY_CONVERSION_REQUIRED y apunta al comando de conversion (caso de uso unico)', async () => {
    const handler = new CreateReservationHandler(buildWorkContext({ role: 'FRONT_OFFICE' }), buildMatrixAuth());

    const error = await handler.execute(buildCommand()).catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        code: 'INQUIRY_CONVERSION_REQUIRED',
        detail: expect.stringContaining('/inquiries/inq-1/commands/convert-to-reservation'),
      }),
    );
  });

  it('sigue exigiendo un contexto empresa/sede vigente (403 antes de revelar nada)', async () => {
    const handler = new CreateReservationHandler(buildWorkContext('forbidden'), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sigue aplicando la politica rol-accion CREATE (403 para un rol sin permiso)', async () => {
    const handler = new CreateReservationHandler(buildWorkContext({ role: 'CAMPO' }), buildMatrixAuth());

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aplica la matriz de roles personalizada de ADM-02 cuando revoca CREATE', async () => {
    const matrixAuth = buildMatrixAuth({
      assertAllowed: jest.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ROLE_NOT_ALLOWED',
          detail: 'El rol FRONT_OFFICE no tiene permiso para realizar la accion CREATE sobre una Reserva segun la matriz vigente (version 2).',
        }),
      ),
    });
    const handler = new CreateReservationHandler(buildWorkContext({ role: 'FRONT_OFFICE' }), matrixAuth);

    await expect(handler.execute(buildCommand())).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
  });
});
