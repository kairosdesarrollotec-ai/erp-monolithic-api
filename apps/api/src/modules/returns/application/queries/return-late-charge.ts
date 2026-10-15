import { computeReturnLatenessCharge, ReturnLatenessCharge } from '../../domain/return-lateness';
import { ReturnRecord } from '../ports/return-repository.port';

/** DEC-DEV-LATE-CHARGE-001: cargo sugerido por retraso. Tarifa = dailyRate vigente del vehículo (igual que charge-immobilization). */
export function chargeFor(record: ReturnRecord, now: Date): ReturnLatenessCharge | null {
  return computeReturnLatenessCharge(record, now, {
    dailyRate: record.vehicleDailyRate,
    deposit: record.rentalDeposit ?? null,
    extensions: record.rentalExtensions ?? null,
  });
}
