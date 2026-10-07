import { ForbiddenException } from '@nestjs/common';
import { RecruitmentAccessService } from './recruitment-access.service';
import {
  BRANCH_ID,
  COMPANY_ID,
  ORG_ID,
  buildMatrixAuth,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';

describe('RecruitmentAccessService', () => {
  it('autoriza correctamente a un usuario con rol RRHH para VIEW_VACANCY', async () => {
    const workContext = buildWorkContext('RRHH');
    const matrixAuth = buildMatrixAuth();
    const service = new RecruitmentAccessService(workContext, matrixAuth);

    const access = await service.authorize(
      { firebaseUid: 'uid-1', companyId: COMPANY_ID, branchId: BRANCH_ID },
      'VIEW_VACANCY',
    );

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith(
      ORG_ID,
      'role-RRHH',
      'RECRUITMENT',
      'VIEW_VACANCY',
      { companyId: COMPANY_ID, branchId: BRANCH_ID },
    );
    expect(access.scope).toEqual({
      organizationId: ORG_ID,
      operatingCompanyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });
    expect(access.context.roleId).toBe('role-RRHH');
  });

  it('lanza ForbiddenException si la asignación del usuario no está vigente', async () => {
    const workContext = buildWorkContext('forbidden');
    const matrixAuth = buildMatrixAuth();
    const service = new RecruitmentAccessService(workContext, matrixAuth);

    await expect(
      service.authorize(
        { firebaseUid: 'uid-forbidden', companyId: COMPANY_ID, branchId: BRANCH_ID },
        'VIEW_VACANCY',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(matrixAuth.assertAllowed).not.toHaveBeenCalled();
  });

  it('lanza ForbiddenException si el rol no tiene el permiso en la matriz', async () => {
    const workContext = buildWorkContext('FRONT_OFFICE');
    const matrixAuth = buildMatrixAuth();
    const service = new RecruitmentAccessService(workContext, matrixAuth);

    await expect(
      service.authorize(
        { firebaseUid: 'uid-1', companyId: COMPANY_ID, branchId: BRANCH_ID },
        'DECIDE_CANDIDATE',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('isActionAllowed retorna booleano sin lanzar excepción para permisos condicionales', async () => {
    const workContext = buildWorkContext('ADMINISTRACION');
    const matrixAuth = buildMatrixAuth();
    const service = new RecruitmentAccessService(workContext, matrixAuth);

    const context = await workContext.authorize({
      firebaseUid: 'uid-1',
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });

    const canViewSensitive = await service.isActionAllowed(context, 'VIEW_CANDIDATE_SENSITIVE_DATA');
    expect(canViewSensitive).toBe(false);

    const canViewCandidate = await service.isActionAllowed(context, 'VIEW_CANDIDATE');
    expect(canViewCandidate).toBe(true);
  });
});
