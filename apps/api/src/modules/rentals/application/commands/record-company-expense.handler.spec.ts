import { NotFoundException } from '@nestjs/common';
import { RecordCompanyExpenseHandler } from './record-company-expense.handler';
import { RecordCompanyExpenseCommand } from './record-company-expense.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { NotaryExpenseCannotBeCustomerPaymentError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

describe('RecordCompanyExpenseHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-100',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Cliente Test',
    customerDocNumber: '12345678',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Hilux',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'ACTIVE',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 1,
  };

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const prisma = {
      companyExpense: {
        create: jest.fn().mockResolvedValue({
          id: 'exp-1',
          companyId: 'comp-1',
          rentalId: 'rent-100',
          expenseType: 'GASTO_NOTARIAL',
          amount: '150.00',
          currency: 'PEN',
          expenseDate: new Date('2026-10-23T10:00:00Z'),
          reference: 'Alquiler rent-100 / ABC-123',
          notes: 'Gastos notariales contrato',
          createdBy: 'uid-user',
          createdAt: new Date('2026-10-23T10:00:00Z'),
        }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        ...testRole('FRONT_OFFICE'),
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    const auditRepository = {
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRepositoryPort>;

    const handler = new RecordCompanyExpenseHandler(
      rentals,
      prisma,
      workContext,
      matrixAuth,
      auditRepository,
    );

    return { handler, rentals, prisma, workContext, matrixAuth, auditRepository };
  }

  it('prohíbe clasificar el gasto notarial como pago del cliente (422 NOTARY_EXPENSE_CANNOT_BE_CUSTOMER_PAYMENT)', async () => {
    const { handler, prisma } = buildDeps();

    const command = new RecordCompanyExpenseCommand(
      'uid-user',
      'rent-100',
      'comp-1',
      'GASTO_NOTARIAL',
      150,
      '2026-10-23T10:00:00Z',
      'Alquiler rent-100',
      'PEN',
      'Intento de cobro a cliente',
      true, // paidByCustomer = true
    );

    await expect(handler.execute(command)).rejects.toBeInstanceOf(NotaryExpenseCannotBeCustomerPaymentError);
    expect(prisma.companyExpense.create).not.toHaveBeenCalled();
  });

  it('registra exitosamente el gasto de la empresa (GASTO_NOTARIAL) y genera evento de auditoria', async () => {
    const { handler, prisma, auditRepository } = buildDeps();

    const command = new RecordCompanyExpenseCommand(
      'uid-user',
      'rent-100',
      'comp-1',
      'GASTO_NOTARIAL',
      150,
      '2026-10-23T10:00:00Z',
      'Alquiler rent-100 / ABC-123',
      'PEN',
      'Gastos notariales contrato',
      false,
    );

    const result = await handler.execute(command);

    expect(prisma.companyExpense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'comp-1',
        rentalId: 'rent-100',
        expenseType: 'GASTO_NOTARIAL',
        reference: 'Alquiler rent-100 / ABC-123',
        notes: 'Gastos notariales contrato',
      }),
    });

    expect(auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_EXPENSE_RECORDED',
        rentalId: 'rent-100',
      }),
    );

    expect(result.expenseType).toBe('GASTO_NOTARIAL');
    expect(result.amount).toBe(150);
  });

  it('lanza NotFoundException si el alquiler no existe en la empresa', async () => {
    const { handler, rentals, prisma } = buildDeps();
    (rentals.findById as jest.Mock).mockResolvedValue(null);

    const command = new RecordCompanyExpenseCommand(
      'uid-user',
      'rent-unknown',
      'comp-1',
      'GASTO_NOTARIAL',
      150,
      '2026-10-23T10:00:00Z',
      'Alquiler rent-unknown',
    );

    await expect(handler.execute(command)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.companyExpense.create).not.toHaveBeenCalled();
  });
});
