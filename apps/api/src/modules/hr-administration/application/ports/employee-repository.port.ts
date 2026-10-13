import type { Employee, EmployeeStatus, Prisma, TerminationReason } from '@prisma/client';

export interface CreateEmployeeData {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  candidateId?: string | null;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  areaId: string;
  areaName: string;
  jobTitle: string;
  status?: EmployeeStatus;
  hireDate: Date;
  baseSalary?: number | null;
}

export interface UpdateEmployeeData {
  branchId?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  areaId?: string;
  areaName?: string;
  jobTitle?: string;
  status?: EmployeeStatus;
  probationPassed?: boolean | null;
  probationEvaluatedAt?: Date | null;
  payrollStartedAt?: Date | null;
  baseSalary?: number | null;
  fieldTripLateCount?: number;
  isFieldTripObserved?: boolean;
}

export interface TerminateEmployeeData {
  terminatedAt: Date;
  terminationReason: TerminationReason;
  terminationNoticeDays: number;
  terminationNotes?: string | null;
}

export interface ListEmployeesFilters {
  organizationId: string;
  companyId: string;
  branchId?: string;
  status?: EmployeeStatus;
  areaId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export abstract class EmployeeRepositoryPort {
  abstract create(data: CreateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee>;
  abstract findById(id: string, tx?: Prisma.TransactionClient): Promise<Employee | null>;
  abstract findByCompanyAndDocument(
    companyId: string,
    documentNumber: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee | null>;
  abstract findManyByIds(ids: string[], tx?: Prisma.TransactionClient): Promise<Employee[]>;
  /** Ficha ya vinculada a la cuenta de acceso del usuario en esa empresa (`GET /me/employee`). */
  abstract findByFirebaseUid(companyId: string, firebaseUid: string, tx?: Prisma.TransactionClient): Promise<Employee | null>;
  /** Colaboradores vigentes (no terminados) de la empresa con ese correo, sin distinguir mayúsculas; máximo 2 filas. */
  abstract findActiveByEmail(companyId: string, email: string, tx?: Prisma.TransactionClient): Promise<Employee[]>;
  /** Vincula la ficha a la cuenta solo si aún no tenía una (condicional); devuelve la ficha vigente. */
  abstract linkFirebaseUid(id: string, firebaseUid: string, tx?: Prisma.TransactionClient): Promise<Employee>;
  abstract findMany(
    filters: ListEmployeesFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<{ items: Employee[]; total: number }>;
  abstract update(id: string, data: UpdateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee>;
  /** Marca TERMINADO de forma condicional; lanza EmploymentAlreadyTerminatedError si ya lo estaba. */
  abstract markTerminated(id: string, data: TerminateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee>;
}
