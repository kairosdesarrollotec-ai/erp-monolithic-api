import { Injectable } from '@nestjs/common';
import { ReturnAccessService } from '../services/return-access.service';
import { CosmeticTariffItem, listCosmeticTariff } from '../../domain/cosmetic-damage-rate';
import { GetCosmeticTariffQuery } from './get-cosmetic-tariff.query';

/** BDD Tabla 9.6.1 / BR-DEV-006 - Catálogo del tarifario de daños estéticos por paño (solo lectura). */
@Injectable()
export class GetCosmeticTariffHandler {
  constructor(private readonly access: ReturnAccessService) {}

  async execute(query: GetCosmeticTariffQuery): Promise<CosmeticTariffItem[]> {
    await this.access.authorize(query, 'READ');
    return listCosmeticTariff();
  }
}
