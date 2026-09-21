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
 * Politica unica de autorizacion de contexto de trabajo (BR-ORG-002,
 * NFR-SEC-001), deny-by-default.
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
 * segunda consulta separada al repositorio.
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
