import { ForbiddenException } from '@nestjs/common';
import type { RolePermissionMatrixPort } from '../../../admin/application/ports/role-permission-matrix.port';
import { testRoleId } from '../../../users/testing/role-fixtures';
import {
  BRANCH_ID,
  COMPANY_ID,
  FixedClock,
  ORG_ID,
  buildMatrixAuth,
  buildWorkContext,
} from '../../testing/recruitment-test-fixtures';
import { RecruitmentAccessService } from '../services/recruitment-access.service';
import type { InterviewerDirectoryPort } from '../ports/interviewer-directory.port';
import { toInterviewerListResponse } from '../../presentation/http/recruitment.mapper';
import { ListInterviewersHandler } from './list-interviewers.handler';
import { INTERVIEWERS_MAX_LIMIT, ListInterviewersQuery } from './list-interviewers.query';

const UID = 'uid-caller';

/** Matriz de organizacion: solo estos roles tienen MANAGE_INTERVIEW. */
function layersWith(allowedRoles: string[], deniedRoles: string[] = []) {
  return [
    {
      version: 1,
      scope: { companyId: null, branchId: null },
      entries: [
        ...allowedRoles.map((r) => ({ roleId: testRoleId(r), module: 'RECRUITMENT' as const, action: 'MANAGE_INTERVIEW', allowed: true })),
        ...deniedRoles.map((r) => ({ roleId: testRoleId(r), module: 'RECRUITMENT' as const, action: 'MANAGE_INTERVIEW', allowed: false })),
      ],
    },
  ];
}

function setup(callerRole: 'RRHH' | 'AUDITORIA' | 'FRONT_OFFICE' = 'RRHH') {
  const access = new RecruitmentAccessService(buildWorkContext(callerRole), buildMatrixAuth());
  const matrix = {
    getLayers: jest.fn().mockResolvedValue(layersWith(['RRHH', 'ADMINISTRACION'], ['FINANZAS'])),
  } as unknown as jest.Mocked<RolePermissionMatrixPort>;
  const directory = {
    listActiveAssignees: jest.fn().mockResolvedValue([
      { firebaseUid: 'u-ana', roleId: testRoleId('RRHH') },
      { firebaseUid: 'u-ana', roleId: testRoleId('RRHH') },
      { firebaseUid: 'u-jose', roleId: testRoleId('ADMINISTRACION') },
      { firebaseUid: 'u-fin', roleId: testRoleId('FINANZAS') },
      { firebaseUid: 'u-campo', roleId: testRoleId('CAMPO') },
      { firebaseUid: 'u-noname', roleId: testRoleId('RRHH') },
    ]),
    findDisplayNames: jest.fn().mockImplementation(async (uids: string[]) => {
      const known: Record<string, string | null> = { 'u-ana': 'Ana Pérez', 'u-jose': 'José Álvarez', 'u-noname': null };
      return Object.fromEntries(uids.map((u) => [u, u in known ? known[u] : 'Otro']));
    }),
  } as unknown as jest.Mocked<InterviewerDirectoryPort>;
  const handler = new ListInterviewersHandler(access, matrix, directory, new FixedClock());
  return { handler, matrix, directory };
}

const q = (search?: string, limit?: number) =>
  new ListInterviewersQuery(UID, COMPANY_ID, BRANCH_ID, search, limit);

describe('ListInterviewersHandler', () => {
  it('un rol sin MANAGE_INTERVIEW ni VIEW_CANDIDATE (Front Office) recibe 403 y no consulta nada', async () => {
    const s = setup('FRONT_OFFICE');
    await expect(s.handler.execute(q())).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.directory.listActiveAssignees).not.toHaveBeenCalled();
  });

  it('un rol con solo VIEW_CANDIDATE (Auditoria) si puede consultar el buscador', async () => {
    const s = setup('AUDITORIA');
    const result = await s.handler.execute(q());
    expect(result.length).toBeGreaterThan(0);
  });

  it('lista solo usuarios cuyo rol tiene MANAGE_INTERVIEW en la matriz, sin duplicados y ordenados por nombre', async () => {
    const s = setup();
    const result = await s.handler.execute(q());
    expect(result).toEqual([
      { id: 'u-ana', fullName: 'Ana Pérez' },
      { id: 'u-jose', fullName: 'José Álvarez' },
      { id: 'u-noname', fullName: 'Usuario sin nombre' },
    ]);
    expect(result.map((r) => r.id)).not.toContain('u-fin');
    expect(result.map((r) => r.id)).not.toContain('u-campo');
    expect(s.matrix.getLayers).toHaveBeenCalledWith(ORG_ID, { companyId: COMPANY_ID, branchId: BRANCH_ID });
    expect(s.directory.findDisplayNames).toHaveBeenCalledWith(['u-ana', 'u-jose', 'u-noname']);
  });

  it('busca por nombre sin distinguir mayusculas ni tildes', async () => {
    const s = setup();
    expect(await s.handler.execute(q('jose'))).toEqual([{ id: 'u-jose', fullName: 'José Álvarez' }]);
    expect(await s.handler.execute(q('  PEREZ '))).toEqual([{ id: 'u-ana', fullName: 'Ana Pérez' }]);
    expect(await s.handler.execute(q('zzz'))).toEqual([]);
  });

  it('respeta limit y lo topa al maximo permitido', async () => {
    const s = setup();
    expect(await s.handler.execute(q(undefined, 1))).toHaveLength(1);
    const many = Array.from({ length: INTERVIEWERS_MAX_LIMIT + 20 }, (_, i) => ({
      firebaseUid: `u-${i}`,
      roleId: testRoleId('RRHH'),
    }));
    s.directory.listActiveAssignees.mockResolvedValue(many);
    expect(await s.handler.execute(q(undefined, 10_000))).toHaveLength(INTERVIEWERS_MAX_LIMIT);
  });

  it('sin asignaciones vigentes devuelve lista vacia sin consultar la matriz', async () => {
    const s = setup();
    s.directory.listActiveAssignees.mockResolvedValue([]);
    expect(await s.handler.execute(q())).toEqual([]);
    expect(s.matrix.getLayers).not.toHaveBeenCalled();
  });

  it('la respuesta HTTP solo contiene id y fullName', async () => {
    const s = setup();
    const response = toInterviewerListResponse(await s.handler.execute(q('ana')));
    expect(response).toEqual({ items: [{ id: 'u-ana', fullName: 'Ana Pérez' }] });
    expect(Object.keys(response.items[0]).sort()).toEqual(['fullName', 'id']);
  });
});
