import { IsOptional, IsUUID } from 'class-validator';

export class GetRolePermissionMatrixQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /**
   * Ambito de la version a mostrar (opcional, ADITIVO respecto al contrato
   * 0.2.0): omitidos = la matriz de toda la organizacion. Con scopeCompanyId
   * (y opcionalmente scopeBranchId) se obtiene la foto vigente de esa
   * empresa/sede, o la que hereda si ese ambito no tiene version propia.
   */
  @IsOptional() @IsUUID() scopeCompanyId?: string;
  @IsOptional() @IsUUID() scopeBranchId?: string;
}
