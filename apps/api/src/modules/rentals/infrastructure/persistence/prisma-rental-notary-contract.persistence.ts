import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  FormalizeContractInput,
  SaveNotaryEvaluationInput,
  ApproveNotaryExceptionInput,
} from '../../application/ports/rental-repository.port';

@Injectable()
export class PrismaRentalNotaryContractPersistence {
  constructor(private readonly prisma: PrismaService) {}

  async saveNotaryEvaluation(
    input: SaveNotaryEvaluationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.notaryEvaluation.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        policyVersion: input.policyVersion,
        result: input.result,
        reason: input.reason,
        approvedBy: input.approvedBy,
        justification: input.justification,
        biometricVerified: input.biometricVerified ?? false,
        biometricVerifiedBy: input.biometricVerifiedBy,
        previousRentalsCount: input.previousRentalsCount,
      },
      update: {
        policyVersion: input.policyVersion,
        result: input.result,
        reason: input.reason,
        // Una re-evaluacion invalida cualquier aprobacion anterior.
        approvedBy: input.approvedBy ?? null,
        justification: input.justification ?? null,
        biometricVerified: input.biometricVerified ?? false,
        biometricVerifiedBy: input.biometricVerifiedBy ?? null,
        previousRentalsCount: input.previousRentalsCount,
      },
    });
  }

  async approveNotaryException(
    input: ApproveNotaryExceptionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    // Russbel 22-oct-2026: la aprobacion NO reescribe el tipo (THIRD_PATH_ELIGIBLE o MANUAL_REVIEW): solo anota quien y por que.
    // La evaluacion siempre existe (se persiste en evaluate-notary aunque requiera aprobacion; el handler lo exige).
    await client.notaryEvaluation.update({
      where: { rentalId: input.id },
      data: {
        approvedBy: input.approvedBy,
        justification: input.justification,
      },
    });
  }

  async formalizeContractAndDeposit(
    input: FormalizeContractInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.rentalContract.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        templateId: input.templateId ?? undefined,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: input.signatureData ?? null,
        contractVariant: input.contractVariant ?? null,
        depositRequired: input.depositRequired,
        // Sin garantia el credito de reserva no tiene a que aplicarse: se guarda aqui como saldo a favor.
        reservationCreditExcess: new Prisma.Decimal(input.depositRequired ? '0' : input.reservationCreditExcess),
      },
      update: {
        templateId: input.templateId ?? undefined,
        documentRef: input.documentRef,
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: input.signatureData ?? null,
        contractVariant: input.contractVariant ?? null,
        depositRequired: input.depositRequired,
        // Sin garantia el credito de reserva no tiene a que aplicarse: se guarda aqui como saldo a favor.
        reservationCreditExcess: new Prisma.Decimal(input.depositRequired ? '0' : input.reservationCreditExcess),
      },
    });

    // DEC-ALQ-COMPANY-DRIVER-004: con conductor de la empresa no se crea garantia.
    if (!input.depositRequired) return;

    // Decision 8 (22-oct-2026): comprobante del cobro (solo si hubo cobro; si la reserva cubre toda la garantia no hay pago).
    const payment = input.payment;
    const paymentData = payment
      ? {
          paymentAmount: new Prisma.Decimal(payment.amount),
          paymentMethod: payment.method,
          paymentOperationNumber: payment.operationNumber?.trim() || null,
          payerName: payment.payerName.trim(),
          payerDocumentNumber: payment.payerDocumentNumber?.trim() || null,
          payerIsExternalAgent: payment.payerIsExternalAgent,
          externalAgentVerifiedBy: payment.externalAgentVerifiedBy ?? null,
          paymentVoucherDocumentId: payment.voucherDocumentId ?? null,
          paymentRegisteredBy: payment.registeredBy,
        }
      : {};

    await client.rentalDeposit.upsert({
      where: { rentalId: input.rentalId },
      create: {
        rentalId: input.rentalId,
        originalAmount: new Prisma.Decimal(input.depositAmount),
        currency: input.currency,
        reservationCreditAmount: new Prisma.Decimal(input.reservationCreditAmount),
        reservationCreditExcess: new Prisma.Decimal(input.reservationCreditExcess),
        status: 'HELD',
        ...paymentData,
      },
      update: {
        originalAmount: new Prisma.Decimal(input.depositAmount),
        currency: input.currency,
        reservationCreditAmount: new Prisma.Decimal(input.reservationCreditAmount),
        reservationCreditExcess: new Prisma.Decimal(input.reservationCreditExcess),
        status: 'HELD',
        ...paymentData,
      },
    });
  }
}
