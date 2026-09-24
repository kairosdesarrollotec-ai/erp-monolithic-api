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
});
