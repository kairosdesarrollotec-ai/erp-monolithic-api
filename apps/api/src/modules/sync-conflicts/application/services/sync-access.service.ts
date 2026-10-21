import { Injectable } from '@nestjs/common';
import {
  AuthorizedWorkContext,
  WorkContextAuthorizationService,
} from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { PermissionModule } from '../../../admin/domain/permission-action-catalog';
import type { SyncChecklistType } from '../../domain/sync-types';
import type { SyncScope } from '../ports/sync-state-repository.port';

export type SyncAction = 'READ' | 'CAPTURE' | 'RESOLVE';

/**
 * ADM-02: NO se crea ninguna accion nueva en el catalogo (el catalogo "solo administra lo que el sistema ya sabe
 * distinguir"). Se reutilizan acciones existentes por tipo de checklist:
 *  - READ / CAPTURE: las mismas de leer / subir evidencia del modulo (quien captura el checklist es quien sincroniza).
 *  - RESOLVE (PROVISIONAL): la documentacion pide un "supervisor" pero no lo mapea a un rol ni a una accion ADM-02.
 *    Se usa la accion existente cuyo set por defecto es exactamente {ADMINISTRACION, GERENCIA}:
 *    RETURN.CLOSE (Devolucion) y RENTAL.MANAGE_CONTRACT_TEMPLATES (Alquiler). Cambiar a una accion dedicada es
 *    cambiar esta tabla (ver pregunta de negocio DEC-SYNC-003).
 */
export const SYNC_PERMISSION_MAP: Readonly<
  Record<SyncChecklistType, Readonly<Record<SyncAction, { module: PermissionModule; action: string }>>>
> = {
  ENTREGA: {
    READ: { module: 'RENTAL', action: 'READ' },
    CAPTURE: { module: 'RENTAL', action: 'UPLOAD_EVIDENCE' },
    RESOLVE: { module: 'RENTAL', action: 'MANAGE_CONTRACT_TEMPLATES' },
  },
  RECEPCION: {
    READ: { module: 'RETURN', action: 'READ' },
    CAPTURE: { module: 'RETURN', action: 'UPLOAD_EVIDENCE' },
    RESOLVE: { module: 'RETURN', action: 'CLOSE' },
  },
};

/** Autorizacion comun del modulo de sincronizacion: contexto de trabajo vigente + matriz ADM-02 (deny-by-default). */
@Injectable()
export class SyncAccessService {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
  ) {}

  authorizeContext(input: { firebaseUid: string; companyId: string; branchId: string }): Promise<AuthorizedWorkContext> {
    return this.workContext.authorize(input);
  }

  async assertAction(context: AuthorizedWorkContext, checklistType: SyncChecklistType, action: SyncAction): Promise<void> {
    const { module, action: matrixAction } = SYNC_PERMISSION_MAP[checklistType][action];
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, module, matrixAction, {
      companyId: context.companyId,
      branchId: context.branchId,
    });
  }

  async authorize(
    input: { firebaseUid: string; companyId: string; branchId: string },
    checklistType: SyncChecklistType,
    action: SyncAction,
  ): Promise<{ context: AuthorizedWorkContext; scope: SyncScope }> {
    const context = await this.authorizeContext(input);
    await this.assertAction(context, checklistType, action);
    return {
      context,
      scope: { organizationId: context.organizationId, operatingCompanyId: input.companyId, branchId: input.branchId },
    };
  }
}
