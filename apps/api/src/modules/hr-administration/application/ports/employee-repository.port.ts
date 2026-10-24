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
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountCci?: string | null;
  contractType?: string | null;
  contractUrl?: string | null;
  contractNotes?: string | null;
}

export interface UpdateEmployeeData {
  branchId?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  /** H-02: solo entrada del comando; el handler lo resuelve a `areaId`/`areaName` y nunca llega al repositorio. */
  areaCode?: string;
  areaId?: string;
  areaName?: string;
  jobTitle?: string;
  status?: EmployeeStatus;
  probationPassed?: boolean | null;
  probationEvaluatedAt?: Date | null;
  payrollStartedAt?: Date | null;
  baseSalary?: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountCci?: string | null;
  contractType?: string | null;
  contractUrl?: string | null;
  contractNotes?: string | null;
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
  /** HU-35: false = la busqueda de texto no incluye el numero de documento. Por defecto true. */
  searchByDocument?: boolean;
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
  /** Reasigna (o limpia con null) la cuenta vinculada de la ficha sin condición previa; solo para re-vinculación por cambio de correo. */
  abstract setFirebaseUid(id: string, firebaseUid: string | null, tx?: Prisma.TransactionClient): Promise<Employee>;
  abstract findMany(
    filters: ListEmployeesFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<{ items: Employee[]; total: number }>;
  /** `options.expectedVersion`: actualización condicional (If-Match); si la versión ya no coincide lanza EmployeeVersionConflictError. */
  abstract update(
    id: string,
    data: UpdateEmployeeData,
    tx?: Prisma.TransactionClient,
    options?: { expectedVersion?: number },
  ): Promise<Employee>;
  /** Marca TERMINADO de forma condicional; lanza EmploymentAlreadyTerminatedError si ya lo estaba. */
  abstract markTerminated(id: string, data: TerminateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee>;
}
