import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ContractTemplateRecord,
  CreateContractTemplateInput,
} from '../../application/ports/rental-repository.port';

@Injectable()
export class PrismaContractTemplatePersistence {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(companyId: string, type: string): Promise<{ id: string; version: number } | null> {
    return this.prisma.contractTemplate.findFirst({
      where: {
        companyId,
        type,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        version: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  async belongsToCompany(templateVersionId: string, companyId: string): Promise<boolean> {
    // Tambien exige status ACTIVE: formalize-contract solo acepta un
    // templateVersionId explicito si ademas esta vigente (BR-DOC-002).
    const row = await this.prisma.contractTemplate.findFirst({
      where: { id: templateVersionId, companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    return row !== null;
  }

  async create(
    input: CreateContractTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ContractTemplateRecord> {
    const client = tx ?? this.prisma;

    const last = await client.contractTemplate.findFirst({
      where: { companyId: input.companyId, type: input.type },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    // Retira la version ACTIVE previa (si existe) antes de insertar la
    // nueva: el indice unico parcial "contract_template_unique_active"
    // (BR-DOC-002) solo permite 1 fila ACTIVE por (company_id, type), y
    // dentro de la misma transaccion el UPDATE ya es visible para el
    // INSERT siguiente.
    await client.contractTemplate.updateMany({
      where: { companyId: input.companyId, type: input.type, status: 'ACTIVE' },
      data: { status: 'RETIRED', effectiveTo: new Date() },
    });

    return client.contractTemplate.create({
      data: {
        companyId: input.companyId,
        type: input.type,
        version: nextVersion,
        effectiveFrom: input.effectiveFrom,
        status: 'ACTIVE',
      },
    });
  }

  async list(companyId: string): Promise<ContractTemplateRecord[]> {
    return this.prisma.contractTemplate.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });
  }
}
