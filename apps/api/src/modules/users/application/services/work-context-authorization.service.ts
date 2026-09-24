import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import type { WorkerRole } from '../../domain/worker-role';

export interface AuthorizedWorkContext {
  organizationId: string;
  companyId: string;
  branchId: string;
  role: WorkerRole;
}

export interface AuthorizeWorkContextInput {
  firebaseUid: string;
  companyId: string;
  branchId: string;
}

/**
 * Politica de autorizacion de CONTEXTO de trabajo (BR-ORG-002,
 * NFR-SEC-001), deny-by-default.
 *
 * ============================================================
 * LO QUE ESTE SERVICIO ES: verifica que (firebaseUid, companyId,
 * branchId) sea una asignacion VIGENTE (active/validFrom/validUntil) de
 * ese usuario, y devuelve el organizationId/role reales de esa
 * asignacion - nunca los que mande el cliente. Responde "¿este usuario
 * puede pararse hoy en esta empresa/sede?".
 *
 * LO QUE ESTE SERVICIO **NO** ES (hallazgo ALTO de revision de
 * seguimiento de PR#5, 12fc688 - "validar contexto no equivale a
 * RBAC/ABAC"): esto NO es una politica de autorizacion por
 * accion/recurso. `authorize()` no recibe que ACCION se quiere hacer
 * (crear una reserva, cerrar una consulta, etc.) ni valida el `role`
 * devuelto contra una lista de roles permitidos para esa accion - por
 * eso los 7 roles de WorkerRole acceden hoy al mismo dashboard
 * (get-dashboard.handler.spec.ts lo confirma explicitamente con
 * `it.each` sobre los 7 roles). Si un modulo futuro (Reservas,
 * Consultas, etc.) llama a `authorize()` y asume que eso alcanza para
 * bloquear una operacion de negocio por rol, ESTA MAL - `authorize()`
 * solo resuelve el contexto (organization/company/branch/role), nunca
 * decide si ese rol puede ejecutar la accion. La politica real
 * `role + action + resource + company/branch`, deny-by-default, vive en
 * ADM-02 (Roles y permisos, PANTALLAS-V2-B-SOPORTE.md) - todavia no
 * construida. Hasta que ADM-02 exista, ningun modulo debe presentar
 * "llama a WorkContextAuthorizationService" como control de autorizacion
 * por rol/accion.
 * ============================================================
 *
 * Hallazgo medio de revision PR#4 ("logica futura duplicada"): antes esta
 * validacion vivia inline dentro de SelectWorkContextHandler. La API es
 * stateless por decision de arquitectura (SDD-KAIROS-TRANSVERSAL.md 9.3)
 * y el contrato exige que el companyId/branchId nunca se confien
 * ciegamente (SDD-KAIROS-TRANSVERSAL.md 14.3) - eso significa que CADA
 * modulo que reciba un companyId/branchId del cliente en cada request
 * (Inquiries, Reservations, etc., no solo TR-05) necesita re-validarlo de
 * la misma forma. Se extrae aqui como servicio de aplicacion reutilizable
 * (exportado desde UsersModule) para que esos modulos futuros lo
 * inyecten en vez de reimplementar la validacion cada vez.
 *
 * Hallazgo alto de revision PR#5 ("el rol se usa para presentacion, no
 * para autorizacion" / "no usa el servicio central
 * WorkContextAuthorizationService"): GetDashboardHandler (TR-06) llamaba
 * directamente al repositorio en vez de pasar por esta politica unica,
 * arriesgando divergencia entre endpoints. `authorize()` ahora tambien
 * devuelve el rol (PROVISIONAL, ver domain/worker-role.ts) de la
 * asignacion vigente, para que TR-06 y cualquier modulo futuro que
 * necesite el rol lo obtengan siempre de esta misma validacion
 * deny-by-default, nunca de un rol enviado por el cliente ni de una
 * segunda consulta separada al repositorio. Ver bloque de arriba: esto
 * resuelve DE DONDE sale el rol de forma confiable, no decide QUE puede
 * hacer ese rol.
 */
@Injectable()
export class WorkContextAuthorizationService {
  constructor(private readonly workContextRepository: WorkContextRepositoryPort) {}

  async authorize(
    input: AuthorizeWorkContextInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AuthorizedWorkContext> {
    const assignment = await this.workContextRepository.findValidAssignment(
      {
        firebaseUid: input.firebaseUid,
        companyId: input.companyId,
        branchId: input.branchId,
      },
      tx,
    );

    if (!assignment) {
      throw new ForbiddenException(
        'La combinacion empresa/sede no es una asignacion vigente para este usuario.',
      );
    }

    return {
      organizationId: assignment.organizationId,
      companyId: input.companyId,
      branchId: input.branchId,
      role: assignment.role,
    };
  }
}
