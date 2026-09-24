import { Module } from '@nestjs/common';
import { ReservationDepositPolicyPort } from './application/ports/reservation-deposit-policy.port';
import { PrismaReservationDepositPolicyRepository } from './infrastructure/persistence/prisma-reservation-deposit-policy.repository';

/**
 * ADM-03 (Catalogos y parametros). Modulo propio (no vive dentro de
 * `admin` ni de `reservations`) porque el mismo parametro lo consumen
 * ambos: `inquiries` lo lee al convertir una Consulta en Reserva
 * (convert-to-reservation.handler.ts) y `admin` lo administra (ADM-03).
 */
@Module({
  providers: [{ provide: ReservationDepositPolicyPort, useClass: PrismaReservationDepositPolicyRepository }],
  exports: [ReservationDepositPolicyPort],
})
export class ParametersModule {}
