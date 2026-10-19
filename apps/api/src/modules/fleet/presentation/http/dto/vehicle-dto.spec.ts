import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';
import { UpdateVehicleDto } from './update-vehicle.dto';

const BASE = {
  companyId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
};
const CREATE_OK = { ...BASE, plate: 'ABC-123', brand: 'Toyota', model: 'Hilux', depositMinimum: 500, passengerCapacity: 5, fuelPrice: 4.5 };

const opts = { whitelist: true, forbidNonWhitelisted: true };
const createErrors = async (o: Record<string, unknown>) =>
  (await validate(plainToInstance(CreateVehicleDto, o), opts)).map((e) => e.property).sort();
const updateErrors = async (o: Record<string, unknown>) =>
  (await validate(plainToInstance(UpdateVehicleDto, o), opts)).map((e) => e.property).sort();

describe('CreateVehicleDto - garantia, capacidad y precio de combustible obligatorios (F-05/G-05)', () => {
  it('acepta el alta completa', async () => {
    expect(await createErrors(CREATE_OK)).toEqual([]);
  });

  it('rechaza si faltan los tres campos', async () => {
    const { depositMinimum, passengerCapacity, fuelPrice, ...rest } = CREATE_OK;
    void depositMinimum; void passengerCapacity; void fuelPrice;
    expect(await createErrors(rest)).toEqual(['depositMinimum', 'fuelPrice', 'passengerCapacity']);
  });

  it('rechaza valores fuera de rango o no enteros', async () => {
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 0 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 61 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, passengerCapacity: 4.5 })).toEqual(['passengerCapacity']);
    expect(await createErrors({ ...CREATE_OK, depositMinimum: -1 })).toEqual(['depositMinimum']);
    expect(await createErrors({ ...CREATE_OK, fuelPrice: -0.01 })).toEqual(['fuelPrice']);
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
  it('valida cuando se envian', async () => {
    expect(await updateErrors({ ...BASE, passengerCapacity: 8, fuelPrice: 5, depositMinimum: 300 })).toEqual([]);
    expect(await updateErrors({ ...BASE, passengerCapacity: 100, fuelPrice: -1, depositMinimum: -5 })).toEqual([
      'depositMinimum', 'fuelPrice', 'passengerCapacity',
    ]);
  });
});
