import { PrismaRateCardAdapter } from './prisma-rate-card.adapter';
import { RateCardNotConfiguredError } from '../../domain/inquiry-errors';
import { HttpStatus } from '@nestjs/common';

const findFirstMock = jest.fn();

const prisma = {
  rateCardEntry: { findFirst: findFirstMock },
} as never;

const COMPANY_ID = 'comp-veloxrent';
const NOW = new Date('2026-10-01T12:00:00Z');

function makeEntry(overrides: Partial<{
  id: string;
  amountPerDay: { toString(): string };
  currency: string;
  validityHours: number;
  effectiveFrom: Date;
}> = {}) {
  return {
    id: 'entry-uuid-1',
    amountPerDay: { toString: () => '120.00' },
    currency: 'PEN',
    validityHours: 72,
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PrismaRateCardAdapter', () => {
  let adapter: PrismaRateCardAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PrismaRateCardAdapter(prisma);
  });

  it('productionReady es true', () => {
    expect(adapter.productionReady).toBe(true);
  });

  it('devuelve la versión activa con los campos correctos', async () => {
    findFirstMock.mockResolvedValue(makeEntry());

    const result = await adapter.currentFor(COMPANY_ID, NOW);

    expect(result.version).toBe('entry-uuid-1');
    expect(result.amountPerDay).toBe('120.00');
    expect(result.currency).toBe('PEN');
    expect(result.validityHours).toBe(72);
  });

  it('consulta con operatingCompanyId y effectiveFrom <= at', async () => {
    findFirstMock.mockResolvedValue(makeEntry());

    await adapter.currentFor(COMPANY_ID, NOW);

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          operatingCompanyId: COMPANY_ID,
          effectiveFrom: { lte: NOW },
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
    );
  });

  it('lanza RateCardNotConfiguredError (503) cuando no hay entrada', async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(adapter.currentFor(COMPANY_ID, NOW)).rejects.toThrow(
      RateCardNotConfiguredError,
    );
  });

  it('RateCardNotConfiguredError tiene status 503 y code RATE_CARD_NOT_CONFIGURED', async () => {
    findFirstMock.mockResolvedValue(null);

    try {
      await adapter.currentFor(COMPANY_ID, NOW);
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateCardNotConfiguredError);
      const e = err as RateCardNotConfiguredError;
      expect(e.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const body = e.getResponse() as { code: string };
      expect(body.code).toBe('RATE_CARD_NOT_CONFIGURED');
    }
  });

  it('no devuelve entradas donde effectiveFrom > at', async () => {
    // El mock simula que findFirst devuelve null (el WHERE ya filtra en DB)
    findFirstMock.mockResolvedValue(null);

    const past = new Date('2026-01-01T00:00:00Z');
    await expect(adapter.currentFor(COMPANY_ID, past)).rejects.toThrow(
      RateCardNotConfiguredError,
    );

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          effectiveFrom: { lte: past },
        }),
      }),
    );
  });

  it('usa el id de la entrada como version string', async () => {
    const customId = 'custom-rate-card-uuid';
    findFirstMock.mockResolvedValue(makeEntry({ id: customId }));

    const result = await adapter.currentFor(COMPANY_ID, NOW);

    expect(result.version).toBe(customId);
  });
});
