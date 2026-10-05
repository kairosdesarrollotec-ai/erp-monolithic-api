import { Prisma } from '@prisma/client';
import { PrismaReturnRepository } from './prisma-return.repository';
import { PrismaReturnDamagePersistence } from './prisma-return-damage.persistence';
import { PrismaImmobilizationChargePersistence } from './prisma-immobilization-charge.persistence';
import { PrismaReturnEvidencePersistence } from './prisma-return-evidence.persistence';
import { ReturnWithRelations } from './return-persistence.mapper';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  RentalAlreadyHasActiveReturnError,
  ReturnNotFoundError,
  ReturnVersionConflictError,
} from '../../domain/return-errors';

describe('PrismaReturnRepository', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };

  const row: ReturnWithRelations = {
    id: 'ret-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    rentalId: 'rent-1',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    status: 'PROGRAMADA',
    custodyHolder: 'CLIENTE',
    customerPresent: true,
    mileageAtReturn: null,
    fuelLevelAtReturn: null,
    alcoholTestResult: null,
    alcoholTestNotes: null,
    alcoholEscalationDecision: null,
    alcoholEscalationMarkedRed: null,
    alcoholEscalationNotes: null,
    alcoholEscalationDecidedById: null,
    alcoholEscalationDecidedAt: null,
    responsibilitySignerName: null,
    responsibilitySignerIsHolder: null,
    responsibilitySignerRelation: null,
    responsibilitySignatureData: null,
    responsibilitySignedAt: null,
    scheduledAt: now,
    receivedAt: null,
    inspectedAt: null,
    closedAt: null,
    finalSettlementAmount: null,
    notes: null,
    createdAt: now,
    createdBy: 'uid-1',
    updatedAt: now,
    updatedBy: 'uid-1',
    version: 2,
    vehicle: { plate: 'ABC-123', dailyRate: null },
    customer: { fullName: 'Juan Perez' },
    damages: [],
    immobilizationCharges: [],
  };

  function build() {
    const client = {
      rentalReturn: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...row, version: 3 }),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const prisma = client as unknown as PrismaService;
    const repo = new PrismaReturnRepository(
      prisma,
      new PrismaReturnDamagePersistence(prisma),
      new PrismaImmobilizationChargePersistence(prisma),
      new PrismaReturnEvidencePersistence(prisma),
    );
    return { client, repo };
  }

  const updateInput = {
    id: 'ret-1',
    scope,
    expectedVersion: 2,
    status: 'RECEPCION_PROVISIONAL' as const,
    updatedBy: 'uid-1',
  };

  it('update: filtra por scope+version, incrementa version y devuelve el registro actualizado', async () => {
    const { client, repo } = build();
    client.rentalReturn.updateMany.mockResolvedValue({ count: 1 });

    const updated = await repo.update(updateInput);

    expect(client.rentalReturn.updateMany).toHaveBeenCalledWith({
      where: { id: 'ret-1', ...scope, version: 2 },
      data: expect.objectContaining({ status: 'RECEPCION_PROVISIONAL', version: { increment: 1 } }),
    });
    expect(updated.version).toBe(3);
  });

  it('update: persiste las columnas de escalada de alcolímetro y documento de responsabilidad', async () => {
    const { client, repo } = build();
    client.rentalReturn.updateMany.mockResolvedValue({ count: 1 });

    await repo.update({
      ...updateInput,
      alcoholEscalationDecision: 'KEEP_IN_CUSTODY',
      alcoholEscalationMarkedRed: true,
      alcoholEscalationNotes: 'Gerencia mantiene custodia',
      alcoholEscalationDecidedById: 'uid-9',
      alcoholEscalationDecidedAt: now,
      responsibilitySignerName: 'Maria Lopez',
      responsibilitySignerIsHolder: false,
      responsibilitySignerRelation: 'Hermana',
      responsibilitySignatureData: 'data:image/png;base64,AAAA',
      responsibilitySignedAt: now,
    });

    expect(client.rentalReturn.updateMany).toHaveBeenCalledWith({
      where: { id: 'ret-1', ...scope, version: 2 },
      data: expect.objectContaining({
        alcoholEscalationDecision: 'KEEP_IN_CUSTODY',
        alcoholEscalationMarkedRed: true,
        alcoholEscalationNotes: 'Gerencia mantiene custodia',
        alcoholEscalationDecidedById: 'uid-9',
        alcoholEscalationDecidedAt: now,
        responsibilitySignerName: 'Maria Lopez',
        responsibilitySignerIsHolder: false,
        responsibilitySignerRelation: 'Hermana',
        responsibilitySignatureData: 'data:image/png;base64,AAAA',
        responsibilitySignedAt: now,
      }),
    });
  });

  it('update: versión desactualizada -> ReturnVersionConflictError (412)', async () => {
    const { client, repo } = build();
    client.rentalReturn.updateMany.mockResolvedValue({ count: 0 });
    client.rentalReturn.findFirst.mockResolvedValue({ id: 'ret-1' });
    await expect(repo.update(updateInput)).rejects.toThrow(ReturnVersionConflictError);
  });

  it('update: expediente fuera del scope -> ReturnNotFoundError (no revela existencia)', async () => {
    const { client, repo } = build();
    client.rentalReturn.updateMany.mockResolvedValue({ count: 0 });
    client.rentalReturn.findFirst.mockResolvedValue(null);
    await expect(repo.update(updateInput)).rejects.toThrow(ReturnNotFoundError);
  });

  it('create: violación de unicidad de rental_id -> RentalAlreadyHasActiveReturnError', async () => {
    const { client, repo } = build();
    client.rentalReturn.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' }),
    );
    await expect(
      repo.create({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        rentalId: 'rent-1',
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        scheduledAt: now,
        createdBy: 'uid-1',
      }),
    ).rejects.toThrow(RentalAlreadyHasActiveReturnError);
  });

  it('findById y list siempre consultan con organización, empresa y sede (aislamiento multiempresa)', async () => {
    const { client, repo } = build();
    client.rentalReturn.findFirst.mockResolvedValue(row);
    client.rentalReturn.findMany.mockResolvedValue([row]);

    await repo.findById('ret-1', scope);
    expect(client.rentalReturn.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ret-1', ...scope } }),
    );

    const cursor = { createdAt: now, id: 'ret-0' };
    await repo.list({ ...scope, status: 'INSPECCION', limit: 5, cursor });
    expect(client.rentalReturn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ ...scope, status: 'INSPECCION', OR: expect.any(Array) }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
