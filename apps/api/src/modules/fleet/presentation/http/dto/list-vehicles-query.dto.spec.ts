import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListVehiclesQueryDto } from './list-vehicles-query.dto';

const BASE = {
  companyId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
};

async function errorsFor(extra: Record<string, unknown>) {
  const dto = plainToInstance(ListVehiclesQueryDto, { ...BASE, ...extra });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('ListVehiclesQueryDto - availableFrom / availableTo', () => {
  it('acepta la consulta sin parámetros de disponibilidad', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('acepta fecha (YYYY-MM-DD) y fecha-hora ISO', async () => {
    expect(await errorsFor({ availableFrom: '2026-10-20', availableTo: '2026-10-25T10:00:00.000Z' })).toHaveLength(0);
  });

  it('rechaza valores que no son ISO 8601', async () => {
    const errors = await errorsFor({ availableFrom: 'mañana', availableTo: '2026-13-45' });
    expect(errors.map((e) => e.property).sort()).toEqual(['availableFrom', 'availableTo']);
  });
});
