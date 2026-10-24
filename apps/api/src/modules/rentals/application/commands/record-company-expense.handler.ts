import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RentalRepositoryPort } from '../ports/rental-repository.port';
import { NotaryExpenseCannotBeCustomerPaymentError } from '../../domain/rental-errors';
import { RecordCompanyExpenseCommand } from './record-company-expense.command';
import { CompanyExpenseResponse } from '../../presentation/http/dto/record-company-expense.dto';

/**
 * BR-ALQ-002, HU-28, SC-ALQ-001 (DEC-ALQ-NOTARY-001):
 * La empresa asume el costo notarial. Se implementa un registro mínimo de gasto de la empresa:
 * monto, fecha, referencia (alquiler/placa), tipo 'GASTO_NOTARIAL'.
 * Está PROHIBIDO clasificarlo como pago del cliente -> 422 NOTARY_EXPENSE_CANNOT_BE_CUSTOMER_PAYMENT.
 */
@Injectable()
export class RecordCompanyExpenseHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly prisma: PrismaService,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordCompanyExpenseCommand): Promise<CompanyExpenseResponse> {
    if (command.paidByCustomer) {
      throw new NotaryExpenseCannotBeCustomerPaymentError();
    }

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
    });
    await this.matrixAuth.assertAllowed(
      context.organizationId,
      context.roleId,
      'RENTAL',
      'FORMALIZE_CONTRACT',
      { companyId: context.companyId },
    );

    const rental = await this.rentals.findById(command.rentalId, {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
    });
    if (!rental) {
      throw new NotFoundException('Alquiler no encontrado.');
    }

    const expense = await this.prisma.companyExpense.create({
      data: {
        companyId: command.companyId,
        rentalId: command.rentalId,
        expenseType: command.expenseType,
        amount: new Prisma.Decimal(command.amount),
        currency: command.currency,
        expenseDate: new Date(command.expenseDate),
        reference: command.reference.trim(),
        notes: command.notes?.trim() || null,
        createdBy: command.firebaseUid,
      },
    });

    await this.auditRepository.recordRentalEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      rentalId: command.rentalId,
      action: 'COMPANY_EXPENSE_RECORDED',
      changes: {
        expenseId: expense.id,
        expenseType: expense.expenseType,
        amount: Number(expense.amount),
        currency: expense.currency,
        reference: expense.reference,
      },
    });

    return {
      id: expense.id,
      companyId: expense.companyId,
      rentalId: expense.rentalId,
      expenseType: expense.expenseType as 'GASTO_NOTARIAL',
      amount: Number(expense.amount),
      currency: expense.currency,
      expenseDate: expense.expenseDate.toISOString(),
      reference: expense.reference,
      notes: expense.notes,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt.toISOString(),
    };
  }
}
