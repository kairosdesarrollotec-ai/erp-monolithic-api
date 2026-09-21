import { PrismaWorkContextRepository } from './prisma-work-context.repository';

/**
 * Hallazgo alto de revision PR#5 ("asignaciones revocadas/expiradas
 * siguen siendo validas" - findValidAssignment/findAssignmentsByFirebaseUid
 * consultaban solo por firebaseUid/clave, sin active/validFrom/
 * validUntil). Estas pruebas no reemplazan la verificacion manual contra
 * Postgres real (ver commit de PR#4: el cliente Prisma en este entorno es
 * un stub sin red hacia binaries.prisma.sh) - fijan en un mock que el
 * repositorio SIEMPRE arma el filtro de vigencia y nunca confia solo en
 * la clave unica (firebaseUid, companyId, branchId).
 */
describe('PrismaWorkContextRepository', () => {
  function buildPrisma(findFirstResult: unknown, findManyResult: unknown[] = []) {
    return {
      userCompanyAssignment: {
        findFirst: jest.fn().mockResolvedValue(findFirstResult),
        findMany: jest.fn().mockResolvedValue(findManyResult),
      },
    } as any;
  }

  describe('findValidAssignment', () => {
    it('filtra por active=true y vigencia [validFrom, validUntil) ademas de la clave unica', async () => {
      const prisma = buildPrisma({
        organizationId: 'org-1',
        role: 'GERENCIA',
      });
      const repository = new PrismaWorkContextRepository(prisma);

      const result = await repository.findValidAssignment({
        firebaseUid: 'uid-1',
        companyId: 'company-1',
        branchId: 'branch-1',
      });

      expect(prisma.userCompanyAssignment.findFirst).toHaveBeenCalledTimes(1);
      const [{ where }] = prisma.userCompanyAssignment.findFirst.mock.calls[0];
      expect(where).toMatchObject({
        firebaseUid: 'uid-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        active: true,
      });
      expect(where.validFrom).toBeDefined();
      expect(where.OR).toEqual(
        expect.arrayContaining([{ validUntil: null }, { validUntil: { gt: expect.any(Date) } }]),
      );
      expect(result).toEqual({ organizationId: 'org-1', role: 'GERENCIA' });
    });

    it('devuelve null cuando no hay fila que cumpla clave + vigencia (revocada, caducada, o cross-company/cross-branch)', async () => {
      const prisma = buildPrisma(null);
      const repository = new PrismaWorkContextRepository(prisma);

      const result = await repository.findValidAssignment({
        firebaseUid: 'uid-1',
        companyId: 'company-ajena',
        branchId: 'branch-ajena',
      });

      expect(result).toBeNull();
    });

    it('participa de una transaccion cuando se le pasa un cliente tx', async () => {
      const prisma = buildPrisma({ organizationId: 'org-1', role: 'GERENCIA' });
      const tx = buildPrisma({ organizationId: 'org-1', role: 'GERENCIA' });
      const repository = new PrismaWorkContextRepository(prisma);

      await repository.findValidAssignment(
        { firebaseUid: 'uid-1', companyId: 'company-1', branchId: 'branch-1' },
        tx,
      );

      expect(tx.userCompanyAssignment.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.userCompanyAssignment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findAssignmentsByFirebaseUid', () => {
    it('filtra por active=true y vigencia [validFrom, validUntil) - nunca lista una asignacion revocada o caducada', async () => {
      const prisma = buildPrisma(null, [
        {
          companyId: 'c1',
          branchId: 'b1',
          role: 'GERENCIA',
          company: { name: 'VeloxRent' },
          branch: { name: 'Ayacucho — Sede Central' },
        },
      ]);
      const repository = new PrismaWorkContextRepository(prisma);

      const result = await repository.findAssignmentsByFirebaseUid('uid-1');

      const [{ where }] = prisma.userCompanyAssignment.findMany.mock.calls[0];
      expect(where).toMatchObject({ firebaseUid: 'uid-1', active: true });
      expect(where.validFrom).toBeDefined();
      expect(where.OR).toEqual(
        expect.arrayContaining([{ validUntil: null }, { validUntil: { gt: expect.any(Date) } }]),
      );
      expect(result).toEqual([
        {
          companyId: 'c1',
          companyName: 'VeloxRent',
          branchId: 'b1',
          branchName: 'Ayacucho — Sede Central',
          role: 'GERENCIA',
        },
      ]);
    });
  });
});
