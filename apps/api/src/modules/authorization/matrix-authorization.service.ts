import { ForbiddenException, Injectable } from '@nestjs/common';
import { RolePermissionMatrixPort } from '../admin/application/ports/role-permission-matrix.port';
import { findEntry, matrixVersionOf } from '../admin/domain/matrix-resolution';
import type { PermissionModule } from '../admin/domain/permission-action-catalog';

/** Alias historico: los modulos que administra la matriz ADM-02 (definicion unica en el catalogo de permisos). */
export type MatrixModule = PermissionModule;

/** Contexto de trabajo (empresa/sede) sobre el que se resuelve el ambito de la matriz. */
export interface MatrixContextScope {
  companyId: string;
  branchId: string;
}

/**
 * ADM-02 (Roles y permisos) - Servicio central de autorización por matriz.
 *
 * ROLES DINAMICOS (fase 2): la autorizacion se evalua por PERMISOS del rol
 * (`roleId`), nunca por el nombre/clave del rol ni por atajos - ni siquiera
 * PLATFORM_ADMIN: sus permisos son filas sembradas de la matriz.
 *
 * Filosofía "deny-by-default": si no existe una entrada explícita para
 * (roleId, modulo, accion) en ninguna capa de la matriz o si `allowed ===
 * false`, la acción se rechaza lanzando ForbiddenException.
 *
 * Ambito: con `scope` (empresa/sede del contexto de trabajo) gana la capa mas
 * especifica que tenga una entrada para el rol y la accion (sede > empresa >
 * organizacion). Sin `scope` solo cuenta la capa de organizacion. Todos los
 * handlers pasan el `scope` de su contexto; asi lo que decide el back coincide
 * con lo que GET /me/permissions le muestra al front.
 *
 * Cuando la organización aún no tiene una versión personalizada guardada en BD
 * (versión 0), la capa de organizacion es la matriz implícita basada en las
 * políticas estáticas (buildDefaultRolePermissionMatrix), garantizando
 * retrocompatibilidad con las reglas por defecto del sistema. Un rol creado a
 * mano nace sin entradas = denegado todo.
 */
@Injectable()
export class MatrixAuthorizationService {
  constructor(private readonly matrix: RolePermissionMatrixPort) {}

  async isAllowed(
    organizationId: string,
    roleId: string,
    module: MatrixModule,
    action: string,
    scope?: MatrixContextScope,
  ): Promise<boolean> {
    const layers = await this.matrix.getLayers(organizationId, scope, { roleId });
    return findEntry(layers, roleId, module, action)?.entry.allowed ?? false;
  }

  async assertAllowed(
    organizationId: string,
    roleId: string,
    module: MatrixModule,
    action: string,
    scope?: MatrixContextScope,
  ): Promise<void> {
    const layers = await this.matrix.getLayers(organizationId, scope, { roleId });
    const entry = findEntry(layers, roleId, module, action)?.entry;
    if (!entry || !entry.allowed) {
      const version = matrixVersionOf(layers);
      if (module === 'ADMIN') {
        throw new ForbiddenException({
          code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX',
          detail: `Tu rol no tiene permitida la accion ADMIN.${action} segun la matriz de permisos vigente (version ${version}).`,
        });
      }
      let entityName = 'un Recurso';
      if (module === 'RESERVATION') entityName = 'una Reserva';
      else if (module === 'INQUIRY') entityName = 'una Consulta';
      else if (module === 'RENTAL') entityName = 'un Alquiler';
      else if (module === 'INCIDENT') entityName = 'una Incidencia';
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        detail: `Tu rol no tiene permiso para realizar la accion ${action} sobre ${entityName} segun la matriz de permisos vigente (version ${version}).`,
      });
    }
  }
}
