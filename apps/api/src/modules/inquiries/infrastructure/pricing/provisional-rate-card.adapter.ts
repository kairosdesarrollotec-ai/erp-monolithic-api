import { Injectable } from '@nestjs/common';
import { RateCardPort, RateCardVersion } from '../../application/ports/rate-card.port';
import { CURRENT_RATE_CARD } from '../../domain/inquiry-rate-card';

/**
 * PROVISIONAL, NO PRODUCTIVO (PROP-007): devuelve siempre el tarifario
 * versionado en codigo (`CURRENT_RATE_CARD`), para cualquier empresa. Se
 * reemplaza por un adaptador sobre una tabla de tarifario versionada cuando
 * el negocio la defina - sin cambios en los handlers.
 */
@Injectable()
export class ProvisionalRateCardAdapter extends RateCardPort {
  readonly productionReady = false;

  async currentFor(_organizationId: string, _operatingCompanyId: string, _at: Date): Promise<RateCardVersion> {
    return CURRENT_RATE_CARD;
  }
}
