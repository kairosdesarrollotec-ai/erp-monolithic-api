import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaTransactionManager } from '../../src/common/persistence/prisma-transaction-manager';
import { PrismaRentalRepository } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental.repository';
import { PrismaContractTemplatePersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-contract-template.persistence';
import { PrismaRentalExtensionPersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental-extension.persistence';
import { PrismaRentalNotaryContractPersistence } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental-notary-contract.persistence';
import { PrismaOutboxEventRepository } from '../../src/modules/outbox/infrastructure/persistence/prisma-outbox-event.repository';
import { PrismaFleetVehicleRepository } from '../../src/modules/fleet/infrastructure/persistence/prisma-fleet-vehicle.repository';
import { PrismaRentalEvidenceRepository } from '../../src/modules/rentals/infrastructure/persistence/prisma-rental-evidence.repository';
import { WorkContextAuthorizationService } from '../../src/modules/users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../src/modules/authorization/matrix-authorization.service';
import { PrismaRolePermissionMatrixRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role-permission-matrix.repository';
import { CreateRentalHandler } from '../../src/modules/rentals/application/commands/create-rental.handler';
import { CreateRentalCommand } from '../../src/modules/rentals/application/commands/create-rental.command';
import { ValidateDocumentsHandler } from '../../src/modules/rentals/application/commands/validate-documents.handler';
import { ValidateDocumentsCommand } from '../../src/modules/rentals/application/commands/validate-documents.command';
import { RegisterAlcoholTestHandler } from '../../src/modules/rentals/application/commands/register-alcohol-test.handler';
import { RegisterAlcoholTestCommand } from '../../src/modules/rentals/application/commands/register-alcohol-test.command';
import { EvaluateNotaryHandler } from '../../src/modules/rentals/application/commands/evaluate-notary.handler';
import { EvaluateNotaryCommand } from '../../src/modules/rentals/application/commands/evaluate-notary.command';
import { ApproveNotaryExceptionHandler } from '../../src/modules/rentals/application/commands/approve-notary-exception.handler';
import { ApproveNotaryExceptionCommand } from '../../src/modules/rentals/application/commands/approve-notary-exception.command';
import { FormalizeContractHandler } from '../../src/modules/rentals/application/commands/formalize-contract.handler';
import { FormalizeContractCommand } from '../../src/modules/rentals/application/commands/formalize-contract.command';
import { CompleteDeliveryHandler } from '../../src/modules/rentals/application/commands/complete-delivery.handler';
import { CompleteDeliveryCommand } from '../../src/modules/rentals/application/commands/complete-delivery.command';
import { GetRentalHandler } from '../../src/modules/rentals/application/queries/get-rental.handler';
import { GetRentalQuery } from '../../src/modules/rentals/application/queries/get-rental.query';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';

/**
 * Ciclo de vida completo del alquiler sobre PostgreSQL real.
 * DRAFT → VALIDATION → NOTARY_EVALUATION → CONTRACTING → PENDING_DELIVERY → ACTIVE
 * Cubre BR-CON-004, BR-ALQ-003/004/005, BR-DOC-002/003, BR-INS-003/004.
 */
describe('Rentals — ciclo de vida completo (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  const org = randomUUID();
  const company = randomUUID();
  const branch = randomUUID();
  const customer = randomUUID();
  const vehicle = randomUUID();
  let templateId: string;

  const UID = 'uid-it-rental';

  function buildPrismaService(): PrismaService {
    return prisma as unknown as PrismaService;
  }

  function buildRentalRepository(): PrismaRentalRepository {
    const ps = buildPrismaService();
    return new PrismaRentalRepository(
      ps,
      new PrismaContractTemplatePersistence(ps),
      new PrismaRentalExtensionPersistence(ps),
      new PrismaRentalNotaryContractPersistence(ps),
    );
  }

  function buildWorkContext(companyId = company, branchId = branch) {
    return {
      authorize: async () => ({ organizationId: org, companyId, branchId, role: 'FRONT_OFFICE' as const }),
    } as unknown as WorkContextAuthorizationService;
  }

  function buildMatrixAuth() {
    const matrixRepo = new PrismaRolePermissionMatrixRepository(buildPrismaService());
    return new MatrixAuthorizationService(matrixRepo);
  }

  function buildAudit() {
    return {
      recordLoginAttempt: async () => undefined,
      recordWorkContextSelection: async () => undefined,
      recordReservationEvent: async () => undefined,
      recordInquiryEvent: async () => undefined,
      recordAdminEvent: async () => undefined,
      recordRentalEvent: async () => undefined,
    } as any;
  }

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;

    await prisma.company.create({ data: { id: company, organizationId: org, name: 'Empresa IT Rental' } });
    await prisma.branch.create({ data: { id: branch, companyId: company, name: 'Sede IT Rental' } });
    await prisma.customer.create({
      data: {
        id: customer,
        organizationId: org,
        operatingCompanyId: company,
        fullName: 'Cliente IT Rental',
        documentType: 'DNI',
        documentNumber: `R${randomUUID().slice(0, 7)}`,
      },
    });
    await prisma.vehicle.create({
      data: {
        id: vehicle,
        organizationId: org,
        operatingCompanyId: company,
        plate: `IT-${vehicle.slice(0, 6)}`,
        brand: 'Nissan',
        model: 'Versa',
      },
    });
    const tpl = await prisma.contractTemplate.create({
      data: {
        companyId: company,
        type: 'STANDARD',
        version: 1,
        effectiveFrom: new Date('2026-01-01'),
        status: 'ACTIVE',
      },
    });
    templateId = tpl.id;
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('ciclo DRAFT → VALIDATION → NOTARY_EVALUATION → CONTRACTING → PENDING_DELIVERY → ACTIVE', async () => {
    const ps = buildPrismaService();
    const rentalRepo = buildRentalRepository();
    const outbox = new PrismaOutboxEventRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const workContext = buildWorkContext();
    const matrixAuth = buildMatrixAuth();
    const audit = buildAudit();
    const fleetVehicles = new PrismaFleetVehicleRepository(ps);
    const evidenceRepository = new PrismaRentalEvidenceRepository(ps);

    // 1. Crear alquiler
    const createHandler = new CreateRentalHandler(rentalRepo, workContext, matrixAuth, txManager, audit, outbox);
    const rental = await createHandler.execute(
      new CreateRentalCommand(
        UID,
        company,
        branch,
        customer,
        vehicle,
        'NORMAL',
        new Date('2026-10-10T09:00:00Z'),
        new Date('2026-10-15T09:00:00Z'),
      ),
    );
    expect(rental.status).toBe('DRAFT');
    const rentalId = rental.id;

    // 2. Validar documentos (DRAFT → VALIDATION)
    const validateHandler = new ValidateDocumentsHandler(rentalRepo, workContext, matrixAuth, txManager, audit);
    const validated = await validateHandler.execute(
      new ValidateDocumentsCommand(rentalId, UID, company, branch, rental.version, {
        identityDocumentValid: true,
        driverLicenseValid: true,
        addressOrStayProofValid: true,
      }),
    );
    expect(validated.status).toBe('VALIDATION');

    // 3. Registrar alcoholímetro FAVORABLE (VALIDATION → NOTARY_EVALUATION)
    const alcoholHandler = new RegisterAlcoholTestHandler(
      rentalRepo,
      workContext,
      matrixAuth,
      txManager,
      audit,
      outbox,
    );
    const alcoholed = await alcoholHandler.execute(
      new RegisterAlcoholTestCommand(rentalId, UID, company, branch, validated.version, 'FAVORABLE'),
    );
    expect(alcoholed.status).toBe('NOTARY_EVALUATION');
    expect(alcoholed.alcoholTestResult).toBe('FAVORABLE');

    // 4. Evaluar notaría (cliente sin alquileres previos → MANDATORY → CONTRACTING automático)
    const evaluateHandler = new EvaluateNotaryHandler(
      rentalRepo,
      workContext,
      matrixAuth,
      txManager,
      audit,
      outbox,
    );
    const evaluated = await evaluateHandler.execute(
      new EvaluateNotaryCommand(rentalId, UID, company, branch, alcoholed.version),
    );

    let contractingRental = evaluated.rental;

    if (evaluated.evaluation.requiresApproval) {
      // Aprobar excepción notarial (si el tercer camino fue activado)
      const approveHandler = new ApproveNotaryExceptionHandler(
        rentalRepo,
        buildWorkContext(),
        matrixAuth,
        txManager,
        audit,
        outbox,
      );
      contractingRental = await approveHandler.execute(
        new ApproveNotaryExceptionCommand(
          rentalId,
          UID,
          company,
          branch,
          evaluated.rental.version,
          'Excepcion aprobada por gerencia para prueba de integracion.',
        ),
      );
    }

    expect(contractingRental.status).toBe('CONTRACTING');

    // 5. Formalizar contrato (CONTRACTING → PENDING_DELIVERY)
    const formalizeHandler = new FormalizeContractHandler(
      rentalRepo,
      workContext,
      matrixAuth,
      txManager,
      audit,
      outbox,
    );
    const formalized = await formalizeHandler.execute(
      new FormalizeContractCommand(
        rentalId,
        UID,
        company,
        branch,
        contractingRental.version,
        templateId,
        `doc-ref-it-${randomUUID().slice(0, 8)}`,
        '500.00',
        'PEN',
      ),
    );
    expect(formalized.status).toBe('PENDING_DELIVERY');

    // 6. Completar entrega (PENDING_DELIVERY → ACTIVE)
    const evidenceScope = { organizationId: org, operatingCompanyId: company, branchId: branch };
    for (let i = 0; i < 35; i++) {
      await evidenceRepository.record({
        rentalId,
        scope: evidenceScope,
        type: 'PHOTO',
        zone: 'FRONTAL',
        objectUrl: `https://storage.test/evidence-photo-${i}.jpg`,
        uploadedBy: UID,
      });
    }
    for (let i = 0; i < 3; i++) {
      await evidenceRepository.record({
        rentalId,
        scope: evidenceScope,
        type: 'VIDEO',
        zone: 'FRONTAL',
        objectUrl: `https://storage.test/evidence-video-${i}.mp4`,
        uploadedBy: UID,
      });
    }
    const completeHandler = new CompleteDeliveryHandler(
      rentalRepo,
      fleetVehicles,
      workContext,
      matrixAuth,
      txManager,
      audit,
      outbox,
      evidenceRepository,
    );
    const delivered = await completeHandler.execute(
      new CompleteDeliveryCommand(rentalId, UID, company, branch, formalized.version, 35, 3),
    );
    expect(delivered.status).toBe('ACTIVE');

    // Verificar que el alquiler queda correctamente guardado
    const getHandler = new GetRentalHandler(rentalRepo, workContext, matrixAuth);
    const fetched = await getHandler.execute(new GetRentalQuery(rentalId, UID, company, branch));
    expect(fetched.status).toBe('ACTIVE');
    expect(fetched.alcoholTestResult).toBe('FAVORABLE');
  }, 90000);

  it('alcoholimetro DESFAVORABLE cancela el alquiler por tolerancia cero (BR-ALQ-005)', async () => {
    const ps = buildPrismaService();
    const rentalRepo = buildRentalRepository();
    const outbox = new PrismaOutboxEventRepository(ps);
    const txManager = new PrismaTransactionManager(ps);
    const workContext = buildWorkContext();
    const matrixAuth = buildMatrixAuth();
    const audit = buildAudit();

    const vehicle2 = randomUUID();
    await prisma.vehicle.create({
      data: {
        id: vehicle2,
        organizationId: org,
        operatingCompanyId: company,
        plate: `IT2-${vehicle2.slice(0, 5)}`,
        brand: 'Kia',
        model: 'Picanto',
      },
    });

    const createHandler = new CreateRentalHandler(rentalRepo, workContext, matrixAuth, txManager, audit, outbox);
    const rental = await createHandler.execute(
      new CreateRentalCommand(
        UID,
        company,
        branch,
        customer,
        vehicle2,
        'NORMAL',
        new Date('2026-11-01T09:00:00Z'),
        new Date('2026-11-05T09:00:00Z'),
      ),
    );

    const validateHandler = new ValidateDocumentsHandler(rentalRepo, workContext, matrixAuth, txManager, audit);
    const validated = await validateHandler.execute(
      new ValidateDocumentsCommand(rental.id, UID, company, branch, rental.version, {
        identityDocumentValid: true,
        driverLicenseValid: true,
        addressOrStayProofValid: true,
      }),
    );

    const alcoholHandler = new RegisterAlcoholTestHandler(
      rentalRepo,
      workContext,
      matrixAuth,
      txManager,
      audit,
      outbox,
    );
    const cancelled = await alcoholHandler.execute(
      new RegisterAlcoholTestCommand(rental.id, UID, company, branch, validated.version, 'DESFAVORABLE'),
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.alcoholTestResult).toBe('DESFAVORABLE');
  }, 60000);
});
