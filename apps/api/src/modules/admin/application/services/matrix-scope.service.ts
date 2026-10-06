import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { MatrixScope } from '../ports/role-permission-matrix.port';

/**
 * Valida y normaliza el ambito (organizacion / empresa / sede) de una version
 * de la matriz ADM-02. Sin valores = toda la organizacion. Una sede exige su
 * empresa. Empresa y sede deben pertenecer a la organizacion del administrador
 * (IDOR): nunca se confia en el id del cliente.
 */
@Injectable()
export class MatrixScopeService {
  constructor(private readonly adminUsers: AdminUserRepositoryPort) {}

  async resolve(
    organizationId: string,
    scopeCompanyId: string | null | undefined,
    scopeBranchId: string | null | undefined,
  ): Promise<MatrixScope> {
    const companyId = scopeCompanyId ?? null;
    const branchId = scopeBranchId ?? null;

    if (branchId !== null && companyId === null) {
      throw new BadRequestException({
        code: 'MATRIX_SCOPE_INVALID',
        detail: 'scopeBranchId requiere scopeCompanyId: una sede siempre pertenece a una empresa.',
      });
    }

    if (companyId !== null) {
      const belongs =
        branchId === null
          ? await this.adminUsers.companyBelongsToOrganization(organizationId, companyId)
          : (await this.adminUsers.findCompanyBranchOwnership(organizationId, companyId, branchId)) !== null;
      if (!belongs) {
        throw new BadRequestException({
          code: 'COMPANY_BRANCH_NOT_IN_ORGANIZATION',
          detail: 'La empresa/sede del ambito no pertenece a la organizacion del administrador.',
        });
      }
    }

    return { companyId, branchId };
  }
}
