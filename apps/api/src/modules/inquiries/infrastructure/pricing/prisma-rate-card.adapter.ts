import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { RateCardPort, RateCardVersion } from '../../application/ports/rate-card.port';
import { RateCardNotConfiguredError } from '../../domain/inquiry-errors';

/**
 * Adaptador real del tarifario versionado.
 * Reemplaza ProvisionalRateCardAdapter (PROP-007).
 *
 * currentFor: devuelve la entrada más reciente de rate_card_versions
 * donde operatingCompanyId coincide y effectiveFrom <= at.
 * Si no existe ninguna: lanza RateCardNotConfiguredError (503).
 *
 * No se modifica ninguna versión existente; las actualizaciones de
 * tarifa crean una nueva fila.
 */
@Injectable()
export class PrismaRateCardAdapter extends RateCardPort {
  readonly productionReady = true;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async currentFor(organizationId: string, operatingCompanyId: string, at: Date): Promise<RateCardVersion> {
    const entry = await this.prisma.rateCardEntry.findFirst({
      where: {
        organizationId,
        operatingCompanyId,
        effectiveFrom: { lte: at },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!entry) {
      throw new RateCardNotConfiguredError(operatingCompanyId);
    }

    return {
      version: entry.id,
      amountPerDay: entry.amountPerDay.toString(),
      currency: entry.currency,
      validityHours: entry.validityHours,
    };
  }
}
