import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './common/persistence/prisma.service';
import { InquiriesController } from './modules/inquiries/presentation/http/inquiries.controller';
import { ReservationsController } from './modules/reservations/presentation/http/reservations.controller';
import { IdempotencyInterceptor } from './common/http/idempotency.interceptor';

/**
 * Humo de inyeccion de dependencias (revalidacion PR#7): IdempotencyPort,
 * ClockPort, FleetAvailabilityPort, RateCardPort y el guard de cotizacion
 * provisional se resuelven desde modulos distintos - este test falla si
 * algun proveedor queda sin registrar, sin necesitar base de datos.
 */
it('AppModule compila y resuelve controllers e interceptor de idempotencia', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  expect(moduleRef.get(InquiriesController)).toBeDefined();
  expect(moduleRef.get(ReservationsController)).toBeDefined();
  expect(moduleRef.get(IdempotencyInterceptor)).toBeDefined();
});
