import { PrismaInquiryRepository } from './prisma-inquiry.repository';
import { InquiryVersionConflictError } from '../../domain/inquiry-errors';

const SCOPE = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };

describe('PrismaInquiryRepository', () => {
  describe('list (hallazgo MEDIO: proyeccion de resumen + keyset real)', () => {
    it('aplica keyset (createdAt, id) estrictamente anterior al cursor, orden DESC y sin include de historial', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const repo = new PrismaInquiryRepository({ inquiry: { findMany } } as any);
      const cursorAt = new Date('2026-09-20T10:00:00Z');

      await repo.list({ ...SCOPE, limit: 20, cursor: { createdAt: cursorAt, id: 'inq-9' } });

      const args = findMany.mock.calls[0][0];
      expect(args.where).toEqual(
        expect.objectContaining({
          ...SCOPE,
          AND: [{ OR: [{ createdAt: { lt: cursorAt } }, { createdAt: cursorAt, id: { lt: 'inq-9' } }] }],
        }),
      );
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect(args.take).toBe(20);
      expect(args).not.toHaveProperty('include');
      expect(args).not.toHaveProperty('cursor');
    });

    it('sin cursor no agrega condicion de keyset', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const repo = new PrismaInquiryRepository({ inquiry: { findMany } } as any);

      await repo.list({ ...SCOPE, limit: 5 });

      expect(findMany.mock.calls[0][0].where.AND).toEqual([]);
    });
  });

  describe('quote', () => {
    function buildTx(count: number) {
      return {
        inquiry: {
          updateMany: jest.fn().mockResolvedValue({ count }),
          findFirstOrThrow: jest.fn().mockResolvedValue({
            id: 'inq-1', ...SCOPE, customerId: null, channel: 'WHATSAPP', touristUse: true, prospectName: 'Ana',
            prospectDocumentType: null, prospectDocumentNumber: null, nationality: 'PERUANO', destination: 'X',
            estimatedDays: 2, travelStartDate: null, partySize: null, countryEntryDate: null, dataOrigin: 'CON02',
            status: 'COTIZADA', closedReason: null, createdAt: new Date(), createdBy: 'uid', version: 2,
            interactions: [], quotations: [],
          }),
        },
        quotation: { create: jest.fn().mockResolvedValue({}) },
        interaction: { create: jest.fn().mockResolvedValue({}) },
      };
    }

    it('guarda la cotizacion con la empresa del scope (FK compuesta consulta/vehiculo) tras transicionar por version+estado', async () => {
      const tx = buildTx(1);
      const repo = new PrismaInquiryRepository({ $transaction: (fn: any) => fn(tx) } as any);

      await repo.quote(
        {
          id: 'inq-1', ...SCOPE, expectedVersion: 1, vehicleId: 'veh-1', destination: 'X', estimatedDays: 2,
          amount: '240.00', currency: 'PEN', rateCardVersionId: 'RC', validUntil: new Date(),
        },
        ['REGISTRADA', 'COTIZADA'],
      );

      expect(tx.inquiry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ ...SCOPE, id: 'inq-1', version: 1, status: { in: ['REGISTRADA', 'COTIZADA'] } }) }),
      );
      expect(tx.quotation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ inquiryId: 'inq-1', operatingCompanyId: 'company-1', vehicleId: 'veh-1' }),
      });
    });

    it('lanza 412 si la version/estado no coincide y no crea la cotizacion', async () => {
      const tx = buildTx(0);
      const repo = new PrismaInquiryRepository({ $transaction: (fn: any) => fn(tx) } as any);

      await expect(
        repo.quote(
          { id: 'inq-1', ...SCOPE, expectedVersion: 9, vehicleId: 'v', destination: 'X', estimatedDays: 1, amount: '1.00', currency: 'PEN', rateCardVersionId: 'RC', validUntil: new Date() },
          ['REGISTRADA'],
        ),
      ).rejects.toBeInstanceOf(InquiryVersionConflictError);
      expect(tx.quotation.create).not.toHaveBeenCalled();
    });
  });

  describe('interactions append-only (P-06)', () => {
    it('quote escribe la interaccion en la MISMA transaccion que la cotizacion', async () => {
      const tx = buildTxWithInteraction();
      const repo = new PrismaInquiryRepository({ $transaction: (fn: any) => fn(tx) } as any);

      await repo.quote(
        {
          id: 'inq-1', ...SCOPE, expectedVersion: 1, vehicleId: 'veh-1', destination: 'X', estimatedDays: 2,
          amount: '240.00', currency: 'PEN', rateCardVersionId: 'RC', validUntil: new Date(),
          interaction: { channel: 'WHATSAPP', outcome: 'COTIZADA', note: 'n' },
        },
        ['REGISTRADA'],
      );

      expect(tx.interaction.create).toHaveBeenCalledWith({ data: { inquiryId: 'inq-1', channel: 'WHATSAPP', outcome: 'COTIZADA', note: 'n' } });
    });

    it('close escribe la interaccion; sin canal (LEGACY_STUB) no escribe nada', async () => {
      const tx = buildTxWithInteraction();
      const repo = new PrismaInquiryRepository({} as any);

      await repo.close({ id: 'inq-1', ...SCOPE, expectedVersion: 1, reason: 'R', interaction: { channel: 'PRESENCIAL', outcome: 'CERRADA_SIN_CONVERSION', note: 'R' } }, ['REGISTRADA'], tx as never);
      expect(tx.interaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ channel: 'PRESENCIAL', outcome: 'CERRADA_SIN_CONVERSION' }) });

      tx.interaction.create.mockClear();
      await repo.close({ id: 'inq-1', ...SCOPE, expectedVersion: 1, reason: 'R', interaction: { channel: null, outcome: 'CERRADA_SIN_CONVERSION' } }, ['REGISTRADA'], tx as never);
      expect(tx.interaction.create).not.toHaveBeenCalled();
    });

    it('si la version no coincide (412) NO se escribe la interaccion', async () => {
      const tx = buildTxWithInteraction(0);
      const repo = new PrismaInquiryRepository({} as any);

      await expect(
        repo.close({ id: 'inq-1', ...SCOPE, expectedVersion: 9, reason: 'R', interaction: { channel: 'WHATSAPP', outcome: 'X' } }, ['REGISTRADA'], tx as never),
      ).rejects.toBeInstanceOf(InquiryVersionConflictError);
      expect(tx.interaction.create).not.toHaveBeenCalled();
    });

    it('create registra la primera interaccion REGISTRADA anidada en el INSERT de la consulta', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'inq-1', ...SCOPE, customerId: 'c', channel: 'WHATSAPP', touristUse: true, destination: 'X', estimatedDays: 1, travelStartDate: null,
        partySize: null, dataOrigin: 'CON02', status: 'REGISTRADA', closedReason: null, createdAt: new Date(), createdBy: 'u', version: 1,
        interactions: [], quotations: [], customer: { nationality: 'EXTRANJERO' },
      });
      const repo = new PrismaInquiryRepository({ inquiry: { create } } as any);

      const record = await repo.create({ ...SCOPE, customerId: 'c', channel: 'WHATSAPP', touristUse: true, destination: 'X', estimatedDays: 1, createdBy: 'u' });

      expect(create.mock.calls[0][0].data.interactions).toEqual({ create: { channel: 'WHATSAPP', outcome: 'REGISTRADA', note: null } });
      expect(record.customerNationality).toBe('EXTRANJERO');
    });
  });
});

function buildTxWithInteraction(count = 1) {
  return {
    inquiry: {
      updateMany: jest.fn().mockResolvedValue({ count }),
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: 'inq-1', ...SCOPE, customerId: null, channel: 'WHATSAPP', touristUse: true, destination: 'X', estimatedDays: 2, travelStartDate: null,
        partySize: null, dataOrigin: 'CON02', status: 'COTIZADA', closedReason: null, createdAt: new Date(), createdBy: 'u', version: 2,
        interactions: [], quotations: [], customer: null,
      }),
    },
    quotation: { create: jest.fn().mockResolvedValue({}) },
    interaction: { create: jest.fn().mockResolvedValue({}) },
  };
}
