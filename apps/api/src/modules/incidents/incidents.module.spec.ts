import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { IncidentsModule } from './incidents.module';
import { IncidentsController } from './presentation/http/incidents.controller';
import { IncidentRepositoryPort } from './application/ports/incident-repository.port';
import { IncidentLinksPort } from './application/ports/incident-links.port';
import { PrismaIncidentRepository } from './infrastructure/persistence/prisma-incident.repository';
import { PrismaIncidentLinksAdapter } from './infrastructure/persistence/prisma-incident-links.adapter';
import { FirebaseAuthGuard } from '../users/infrastructure/auth/firebase-auth.guard';
import { WorkContextAuthorizationService } from '../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../outbox/application/ports/outbox-event-repository.port';
import { IdempotencyPort } from '../../common/application/ports/idempotency.port';
import { PrismaService } from '../../common/persistence/prisma.service';

/**
 * Verifica el grafo de inyeccion de IncidentsModule (tokens abstractos, constructores de todos los handlers y del
 * controller) sin base de datos: los modulos importados y la infraestructura se sustituyen por dobles.
 */
describe('IncidentsModule (grafo de inyeccion)', () => {
  it('declara controller, proveedores y puertos esperados', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IncidentsModule) as Array<unknown>;
    const tokens = providers.map((p) => (typeof p === 'function' ? p : (p as { provide: unknown }).provide));
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, IncidentsModule)).toEqual([IncidentsController]);
    expect(tokens).toEqual(expect.arrayContaining([IncidentRepositoryPort, IncidentLinksPort]));
    expect(providers.find((p) => (p as { provide?: unknown }).provide === IncidentRepositoryPort)).toMatchObject({ useClass: PrismaIncidentRepository });
    expect(providers.find((p) => (p as { provide?: unknown }).provide === IncidentLinksPort)).toMatchObject({ useClass: PrismaIncidentLinksAdapter });
  });

  it('resuelve el controller con todos sus handlers (constructores completos)', async () => {
    const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IncidentsModule) as Array<unknown>).filter(
      (p) => typeof p === 'function' || ((p as { provide: unknown }).provide !== IncidentRepositoryPort && (p as { provide: unknown }).provide !== IncidentLinksPort),
    );
    const stub = (token: unknown) => ({ provide: token, useValue: {} });
    const moduleRef = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        ...(providers as never[]),
        { provide: IncidentRepositoryPort, useValue: {} },
        { provide: IncidentLinksPort, useValue: {} },
        stub(WorkContextAuthorizationService),
        stub(MatrixAuthorizationService),
        stub(TransactionManagerPort),
        stub(ClockPort),
        stub(AuditEventRepositoryPort),
        stub(OutboxEventRepositoryPort),
        stub(PrismaService),
        stub(IdempotencyPort),
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    expect(moduleRef.get(IncidentsController)).toBeInstanceOf(IncidentsController);
    await moduleRef.close();
  });
});
