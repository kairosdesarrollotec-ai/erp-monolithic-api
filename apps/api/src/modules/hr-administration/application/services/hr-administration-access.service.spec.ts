import { ForbiddenException } from '@nestjs/common';
import { HrAdministrationAccessService } from './hr-administration-access.service';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

describe('HrAdministrationAccessService', () => {
  let service: HrAdministrationAccessService;
  let mockWorkContext: jest.Mocked<WorkContextAuthorizationService>;
  let mockMatrixAuth: jest.Mocked<MatrixAuthorizationService>;

  const baseContext: AuthorizedWorkContext = {
    organizationId: 'org-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    roleId: 'RRHH',
    roleName: 'RRHH',
    roleKey: 'RRHH',
  };

  beforeEach(() => {
    mockWorkContext = {
      authorize: jest.fn().mockResolvedValue(baseContext),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    mockMatrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
      isAllowed: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    service = new HrAdministrationAccessService(mockWorkContext, mockMatrixAuth);
  });

  describe('authorize', () => {
    it('permite acceso y retorna contexto y alcance', async () => {
      const result = await service.authorize(
        { firebaseUid: 'fb-1', companyId: 'comp-1', branchId: 'branch-1' },
        'VIEW_EMPLOYEES',
      );

      expect(result.context).toEqual(baseContext);
      expect(result.scope).toEqual({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      });
      expect(mockMatrixAuth.assertAllowed).toHaveBeenCalledWith(
        'org-1',
        'RRHH',
        'HR_ADMINISTRATION',
        'VIEW_EMPLOYEES',
        { companyId: 'comp-1', branchId: 'branch-1' },
      );
    });

    it('propaga error si MatrixAuthorizationService rechaza', async () => {
      mockMatrixAuth.assertAllowed.mockRejectedValue(
        new ForbiddenException({ code: 'ROLE_NOT_ALLOWED' }),
      );

      await expect(
        service.authorize(
          { firebaseUid: 'fb-1', companyId: 'comp-1', branchId: 'branch-1' },
          'TERMINATE_EMPLOYMENT',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('authorizeAny', () => {
    it('retorna exitosamente si alguna acción está permitida', async () => {
      mockMatrixAuth.isAllowed.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const result = await service.authorizeAny(
        { firebaseUid: 'fb-1', companyId: 'comp-1', branchId: 'branch-1' },
        ['TERMINATE_EMPLOYMENT', 'VIEW_EMPLOYEES'],
      );

      expect(result.scope.operatingCompanyId).toBe('comp-1');
    });

    it('falla con ForbiddenException si ninguna acción está permitida', async () => {
      mockMatrixAuth.isAllowed.mockResolvedValue(false);
      mockMatrixAuth.assertAllowed.mockRejectedValue(
        new ForbiddenException({ code: 'ROLE_NOT_ALLOWED' }),
      );

      await expect(
        service.authorizeAny(
          { firebaseUid: 'fb-1', companyId: 'comp-1', branchId: 'branch-1' },
          ['TERMINATE_EMPLOYMENT', 'AUTHORIZE_LEAVE'],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('isActionAllowed', () => {
    it('consulta MatrixAuthorizationService', async () => {
      mockMatrixAuth.isAllowed.mockResolvedValue(true);
      const res = await service.isActionAllowed(baseContext, 'MANAGE_EMPLOYEES');
      expect(res).toBe(true);
      expect(mockMatrixAuth.isAllowed).toHaveBeenCalledWith(
        'org-1',
        'RRHH',
        'HR_ADMINISTRATION',
        'MANAGE_EMPLOYEES',
        { companyId: 'comp-1', branchId: 'branch-1' },
      );
    });
  });
});
