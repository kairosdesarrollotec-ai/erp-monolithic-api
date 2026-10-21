import { MatrixReturnAlertRecipientsPersistence } from './matrix-return-alert-recipients.persistence';

describe('MatrixReturnAlertRecipientsPersistence (Respuestas 2026-10-20 #8)', () => {
  const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'br-1' };

  it('devuelve las keys de los roles de sistema con NOTIFICATIONS.RECEIVE_RETURN_ALERTS en la empresa/sede', async () => {
    const prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r-adm', key: 'ADMINISTRACION' },
          { id: 'r-fin', key: 'FINANZAS' },
          { id: 'r-cam', key: 'CAMPO' },
        ]),
      },
    };
    const matrix = { isAllowed: jest.fn().mockImplementation(async (_o: string, roleId: string) => roleId !== 'r-cam') };
    const roles = await new MatrixReturnAlertRecipientsPersistence(prisma as never, matrix as never).rolesWithAlertPermission(scope);
    expect(roles).toEqual(['ADMINISTRACION', 'FINANZAS']);
    expect(prisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1', key: { not: null } } }));
    expect(matrix.isAllowed).toHaveBeenCalledWith('org-1', 'r-fin', 'NOTIFICATIONS', 'RECEIVE_RETURN_ALERTS', { companyId: 'comp-1', branchId: 'br-1' });
  });

  it('sin ningun rol con permiso devuelve vacio', async () => {
    const prisma = { role: { findMany: jest.fn().mockResolvedValue([{ id: 'r', key: 'CAMPO' }]) } };
    const matrix = { isAllowed: jest.fn().mockResolvedValue(false) };
    await expect(new MatrixReturnAlertRecipientsPersistence(prisma as never, matrix as never).rolesWithAlertPermission(scope)).resolves.toEqual([]);
  });
});
