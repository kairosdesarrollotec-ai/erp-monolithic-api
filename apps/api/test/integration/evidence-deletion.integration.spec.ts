import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaEvidenceDeletionRequestRepository } from '../../src/modules/evidence/infrastructure/persistence/prisma-evidence-deletion-request.repository';
import { EvidenceDeletionAlreadyRequestedError } from '../../src/modules/evidence/domain/evidence-deletion-errors';
import { ensureSystemRoles } from '../../src/modules/admin/infrastructure/persistence/system-roles-seeder';
import { MatrixCatalogSyncService } from '../../src/modules/admin/infrastructure/persistence/matrix-catalog-sync.service';
import { PERMISSION_ACTION_CATALOG } from '../../src/modules/admin/domain/permission-action-catalog';

/**
 * P5 (doble aprobacion para eliminar evidencia) y P1 (permisos nuevos en matrices ya guardadas) sobre PostgreSQL REAL:
 * migraciones 20261021020001_evidence_deletion_requests (CHECK de separacion de funciones, indice unico parcial) y el
 * backfill idempotente de MatrixCatalogSyncService. No se pudo ejecutar en el entorno de desarrollo sin Docker: revisar en CI.
 */
describe('Eliminacion de evidencia con doble aprobacion y backfill de permisos (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let repo: PrismaEvidenceDeletionRequestRepository;

  const org = randomUUID();
  const company = randomUUID();
  const branch = randomUUID();
  const now = new Date();
  const base = (evidenceId: string) => ({
    organizationId: org,
    operatingCompanyId: company,
    branchId: branch,
    targetKind: 'RENTAL' as const,
    parentId: randomUUID(),
    evidenceId,
    evidenceSnapshot: { type: 'PHOTO', zone: 'FRONT', objectUrl: 'gs://b/o', uploadedBy: 'u', uploadedAt: now.toISOString() },
    reason: 'Foto subida por error',
    requestedBy: 'u-req',
    requestedAt: now,
    expiresAt: new Date(now.getTime() + 7 * 86_400_000),
  });

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
    repo = new PrismaEvidenceDeletionRequestRepository(prisma as unknown as PrismaService);
  }, 60000);
  afterAll(async () => db?.stop());

  it('una sola solicitud ABIERTA por evidencia (indice unico parcial); cerrada la anterior se puede abrir otra', async () => {
    const evidenceId = randomUUID();
    const first = await repo.create(base(evidenceId));
    expect(first.status).toBe('PENDING');
    await expect(repo.create(base(evidenceId))).rejects.toBeInstanceOf(EvidenceDeletionAlreadyRequestedError);

    const rejected = await repo.transition(
      first.id,
      { statuses: ['PENDING'], version: first.version },
      { status: 'REJECTED', rejectedBy: 'u-a', rejectedAt: now, rejectionReason: 'No procede' },
    );
    expect(rejected?.status).toBe('REJECTED');
    await expect(repo.create(base(evidenceId))).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('transicion con guarda de estado + version: el segundo escritor pierde (null) y la version solo sube una vez', async () => {
    const created = await repo.create(base(randomUUID()));
    const patch = { status: 'APPROVED_1' as const, firstApprovedBy: 'u-a', firstApprovedAt: now };
    const [a, b] = await Promise.all([
      repo.transition(created.id, { statuses: ['PENDING'], version: created.version }, patch),
      repo.transition(created.id, { statuses: ['PENDING'], version: created.version }, { ...patch, firstApprovedBy: 'u-b' }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const stored = await prisma.evidenceDeletionRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.version).toBe(2);
    expect(stored.status).toBe('APPROVED_1');
  });

  it('la base impone la separacion de funciones: solicitante no aprueba, 2o aprobador distinto del 1o, no se ejecuta sin dos aprobadores', async () => {
    const created = await repo.create(base(randomUUID()));
    const update = (data: Record<string, unknown>) => prisma.evidenceDeletionRequest.update({ where: { id: created.id }, data: data as never });

    await expect(update({ firstApprovedBy: 'u-req' })).rejects.toThrow(); // solicitante = aprobador
    await expect(update({ secondApprovedBy: 'u-x' })).rejects.toThrow(); // 2a sin 1a
    await expect(update({ firstApprovedBy: 'u-a', secondApprovedBy: 'u-a' })).rejects.toThrow(); // 2o = 1o
    await expect(update({ firstApprovedBy: 'u-a', secondApprovedBy: 'u-req' })).rejects.toThrow(); // 2o = solicitante
    await expect(update({ status: 'EXECUTED' })).rejects.toThrow(); // ejecutada sin aprobadores
    await expect(update({ status: 'REJECTED', rejectedBy: 'u-req', rejectionReason: 'x y z', rejectedAt: now })).rejects.toThrow(); // solicitante rechaza
    await expect(update({ status: 'BOGUS' })).rejects.toThrow();
    await expect(
      update({ firstApprovedBy: 'u-a', secondApprovedBy: 'u-b', status: 'EXECUTED', executedAt: now }),
    ).resolves.toMatchObject({ status: 'EXECUTED' });
  });

  it('motivo obligatorio tambien en la base (>= 5 caracteres)', async () => {
    await expect(repo.create({ ...base(randomUUID()), reason: '  ab ' })).rejects.toThrow();
  });

  it('lista con estado efectivo: las abiertas vencidas aparecen como EXPIRED y no como PENDING; findDueOpen las encuentra', async () => {
    const expiredOrg = randomUUID();
    const mk = (over: Record<string, unknown>) => repo.create({ ...base(randomUUID()), organizationId: expiredOrg, ...over } as never);
    const vigente = await mk({});
    const vencida = await mk({ expiresAt: new Date(now.getTime() - 1000) });
    const filter = { organizationId: expiredOrg, operatingCompanyId: company, now, limit: 50 };

    expect((await repo.list({ ...filter, status: 'PENDING' })).map((r) => r.id)).toEqual([vigente.id]);
    expect((await repo.list({ ...filter, status: 'EXPIRED' })).map((r) => r.id)).toEqual([vencida.id]);
    expect((await repo.findDueOpen(now, 500)).map((r) => r.id)).toContain(vencida.id);
  });

  describe('P1: MatrixCatalogSyncService (permisos nuevos en organizaciones con matriz ya guardada)', () => {
    it('inserta SOLO las filas faltantes en la version vigente, respeta lo retirado a proposito y es idempotente', async () => {
      const syncOrg = randomUUID();
      await prisma.company.create({ data: { id: randomUUID(), organizationId: syncOrg, name: 'Empresa sync' } });
      const ids = await ensureSystemRoles(prisma, syncOrg);
      const gerencia = ids.get('GERENCIA') as string;
      const campo = ids.get('CAMPO') as string;

      // Foto guardada "vieja": solo una accion (lo demas = no existia al guardarla), con RECEIVE_RETURN_ALERTS retirada a proposito a GERENCIA.
      await prisma.rolePermissionMatrixVersion.createMany({
        data: [
          { organizationId: syncOrg, version: 1, roleId: gerencia, action: 'RESERVATION.CREATE', allowed: true, createdBy: 'u' },
          { organizationId: syncOrg, version: 1, roleId: gerencia, action: 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS', allowed: false, createdBy: 'u' },
          { organizationId: syncOrg, version: 1, roleId: campo, action: 'RESERVATION.CREATE', allowed: false, createdBy: 'u' },
        ],
      });

      const sync = new MatrixCatalogSyncService(prisma as unknown as PrismaService);
      const inserted = await sync.syncOrganization(syncOrg);
      expect(inserted).toBe(2 * PERMISSION_ACTION_CATALOG.length - 3);

      const rows = await prisma.rolePermissionMatrixVersion.findMany({ where: { organizationId: syncOrg, version: 1 } });
      const get = (roleId: string, action: string) => rows.find((r) => r.roleId === roleId && r.action === action)?.allowed;
      expect(get(gerencia, 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS')).toBe(false); // retirada a proposito: no se pisa
      expect(get(gerencia, 'HR_ADMINISTRATION.MANAGE_SALARY')).toBe(true);
      expect(get(gerencia, 'RECRUITMENT.TERMINATE_PROBATION')).toBe(true);
      expect(get(gerencia, 'EVIDENCE.APPROVE_DELETION')).toBe(true);
      expect(get(campo, 'HR_ADMINISTRATION.MANAGE_SALARY')).toBe(false);
      expect(get(campo, 'EVIDENCE.REQUEST_DELETION')).toBe(false);
      expect(new Set(rows.map((r) => r.roleId))).toEqual(new Set([gerencia, campo])); // roles sin filas no se tocan
      expect(rows.every((r) => r.version === 1)).toBe(true); // no se creo una version nueva

      expect(await sync.syncOrganization(syncOrg)).toBe(0); // idempotente
    });

    it('sin matriz guardada (version 0 implicita) no escribe nada', async () => {
      const emptyOrg = randomUUID();
      await ensureSystemRoles(prisma, emptyOrg);
      expect(await new MatrixCatalogSyncService(prisma as unknown as PrismaService).syncOrganization(emptyOrg)).toBe(0);
      expect(await prisma.rolePermissionMatrixVersion.count({ where: { organizationId: emptyOrg } })).toBe(0);
    });
  });
});
