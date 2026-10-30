import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';
import { UpdateVehicleDto } from './update-vehicle.dto';

const BASE = {
  companyId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
};
const CREATE_OK = { ...BASE, plate: 'ABC-123', brand: 'Toyota', model: 'Hilux', depositMinimum: 500, passengerCapacity: 5, fuelPrice: 4.5, fuelPenaltyPerLine: 12.5 };

const opts = { whitelist: true, forbidNonWhitelisted: true };
const createErrors = async (o: Record<string, unknown>) =>
  (await validate(plainToInstance(CreateVehicleDto, o), opts)).map((e) => e.property).sort();
const updateErrors = async (o: Record<string, unknown>) =>
  (await validate(plainToInstance(UpdateVehicleDto, o), opts)).map((e) => e.property).sort();

describe('CreateVehicleDto - capacidad obligatoria en handler (DEC-FLT-CAP-001); garantia y combustible opcionales', () => {
  it('acepta el alta completa', async () => {
    expect(await createErrors(CREATE_OK)).toEqual([]);
  });

  it('acepta el alta sin garantia ni precio de combustible (siguen opcionales)', async () => {
    const { depositMinimum, fuelPrice, ...rest } = CREATE_OK;
    void depositMinimum; void fuelPrice;
    expect(await createErrors(rest)).toEqual([]);
  });

  it('la ausencia de passengerCapacity la rechaza CreateVehicleHandler con 400 PASSENGER_CAPACITY_REQUIRED, no el DTO', async () => {
    const { passengerCapacity, ...rest } = CREATE_OK;
    void passengerCapacity;
    expect(await createErrors(rest)).toEqual([]);
  });

  it('rechaza valores fuera de rango o no enteros', async () => {
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 0 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 61 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 4.5 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, depositMinimum: -1 })).toEqual(['depositMinimum']);
    expect(await createErrors({ ...CREATE_OK, fuelPrice: -0.01 })).toEqual(['fuelPrice']);
  });

  it('fuelPenaltyPerLine es obligatorio y > 0 (decisión 28-oct #1)', async () => {
    const { fuelPenaltyPerLine, ...rest } = CREATE_OK;
    void fuelPenaltyPerLine;
    expect(await createErrors(rest)).toEqual(['fuelPenaltyPerLine']);
    expect(await createErrors({ ...CREATE_OK, fuelPenaltyPerLine: 0 })).toEqual(['fuelPenaltyPerLine']);
  });

  it('fuelPenaltyPerLine es obligatorio y > 0 (decisión 28-oct #1)', async () => {
    const { fuelPenaltyPerLine, ...rest } = CREATE_OK;
    void fuelPenaltyPerLine;
    expect(await createErrors(rest)).toEqual(['fuelPenaltyPerLine']);
    expect(await createErrors({ ...CREATE_OK, fuelPenaltyPerLine: 0 })).toEqual(['fuelPenaltyPerLine']);
  });

  it('acepta los limites 1 y 60 y cero en montos', async () => {
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 1, depositMinimum: 0, fuelPrice: 0 })).toEqual([]);
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 60 })).toEqual([]);
  });
});

describe('UpdateVehicleDto - campos opcionales con las mismas validaciones', () => {
  it('acepta la edicion sin los campos', async () => {
    expect(await updateErrors(BASE)).toEqual([]);
  });
  it('deja pasar passengerCapacity null: lo rechaza UpdateVehicleHandler con PASSENGER_CAPACITY_REQUIRED', async () => {
    expect(await updateErrors({ ...BASE, passengerCapacity: null })).toEqual([]);
  });
  it('valida cuando se envian', async () => {
    expect(await updateErrors({ ...BASE, passengerCapacity: 8, fuelPrice: 5, depositMinimum: 300 })).toEqual([]);
    expect(await updateErrors({ ...BASE, passengerCapacity: 100, fuelPrice: -1, depositMinimum: -5 })).toEqual([
      'depositMinimum', 'fuelPrice', 'passengerCapacity',
    ]);
  });
});
