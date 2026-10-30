import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CustomerRepositoryPort,
  CreateCustomerData,
  ListCustomersFilter,
  UpdateCustomerData,
} from '../../application/ports/customer-repository.port';
import { Customer } from '../../domain/customer';

@Injectable()
export class PrismaCustomerRepository extends CustomerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async findByDocument(
    documentType: string,
    documentNumber: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({
      where: {
        documentType,
        documentNumber,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async list(filter: ListCustomersFilter): Promise<{ items: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      organizationId: filter.organizationId,
      operatingCompanyId: filter.operatingCompanyId,
    };

    if (filter.search) {
      where.OR = [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { documentNumber: { contains: filter.search } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    const row = await this.prisma.customer.create({
      data: {
        id: randomUUID(),
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nationality: data.nationality,
        countryEntryDate: data.countryEntryDate,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });

    return this.toDomain(row);
  }

  async update(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    data: UpdateCustomerData,
  ): Promise<Customer> {
    const row = await this.prisma.customer.update({
      where: {
        id_operatingCompanyId: {
          id,
          operatingCompanyId: scope.operatingCompanyId,
        },
      },
      data: {
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nationality: data.nationality,
        countryEntryDate: data.countryEntryDate,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });

    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    nationality: 'PERUANO' | 'EXTRANJERO' | null;
    countryEntryDate: Date | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    status?: string | null;
    statusReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return {
      id: row.id,
      organizationId: row.organizationId,
      operatingCompanyId: row.operatingCompanyId,
      fullName: row.fullName,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      nationality: row.nationality,
      countryEntryDate: row.countryEntryDate,
      email: row.email,
      phone: row.phone,
      address: row.address,
      riskStatus: row.status === 'AMBAR' || row.status === 'ROJO' ? row.status : 'NORMAL',
      riskReason: row.statusReason ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
