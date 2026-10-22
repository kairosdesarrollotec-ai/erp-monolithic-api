import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { FULL_EMPLOYEE_VISIBILITY } from '../../application/services/employee-field-visibility.service';
import { buildEmployee } from '../../testing/hr-administration-test-fixtures';

function build(result: { accountRelink: 'RELINKED' | 'UNLINKED' | null; previousEmail?: string | null }) {
  const employee = buildEmployee({ email: 'nuevo@kairos.pe', version: 4 });
  const updateEmployee = { executeDetailed: jest.fn().mockResolvedValue({ employee, accountRelink: result.accountRelink, previousEmail: result.previousEmail ?? 'ana@kairos.pe' }) };
  const visibility = { resolve: jest.fn().mockResolvedValue(FULL_EMPLOYEE_VISIBILITY) };
  const controller = new EmployeesController(
    {} as never, updateEmployee as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    visibility as never,
  );
  const res = { setHeader: jest.fn() };
  const req = { firebaseUid: 'uid-1' };
  return { controller, updateEmployee, res, req };
}

describe('EmployeesController PATCH /employees/{id} (If-Match, ETag, accountRelink)', () => {
  it('pasa la versión de If-Match al comando y devuelve ETag con la versión nueva', async () => {
    const { controller, updateEmployee, res, req } = build({ accountRelink: null });
    const body = await controller.update(req as never, 'emp-1', { jobTitle: 'X' } as never, '"3"', res as never);
    expect(updateEmployee.executeDetailed.mock.calls[0][0].expectedVersion).toBe(3);
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"4"');
    expect(body.version).toBe(4);
    expect(body.accountRelink).toBeUndefined();
  });

  it('sin If-Match no envía versión esperada', async () => {
    const { controller, updateEmployee, res, req } = build({ accountRelink: null });
    await controller.update(req as never, 'emp-1', { jobTitle: 'X' } as never, undefined, res as never);
    expect(updateEmployee.executeDetailed.mock.calls[0][0].expectedVersion).toBeUndefined();
  });

  it('If-Match mal formado = 400 IF_MATCH_INVALID', async () => {
    const { controller, res, req } = build({ accountRelink: null });
    await expect(controller.update(req as never, 'emp-1', {} as never, 'abc', res as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('incluye accountRelink solo cuando hubo re-vinculación', async () => {
    const { controller, res, req } = build({ accountRelink: 'RELINKED' });
    const body = await controller.update(req as never, 'emp-1', { email: 'nuevo@kairos.pe' } as never, '"3"', res as never);
    expect(body.accountRelink).toEqual({ action: 'RELINKED', reason: 'EMAIL_CHANGED', previousEmail: 'ana@kairos.pe', newEmail: 'nuevo@kairos.pe' });
    const u = build({ accountRelink: 'UNLINKED' });
    const body2 = await u.controller.update(u.req as never, 'emp-1', {} as never, undefined, u.res as never);
    expect(body2.accountRelink?.action).toBe('UNLINKED');
  });
});
