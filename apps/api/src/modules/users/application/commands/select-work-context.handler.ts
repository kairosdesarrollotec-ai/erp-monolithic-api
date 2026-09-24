import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { WorkContextAuthorizationService } from '../services/work-context-authorization.service';
import { SelectWorkContextCommand } from './select-work-context.command';

/**
 * TR-05: valida y audita la seleccion de contexto de trabajo (empresa/
 * sede) elegida por el usuario.
 *
 * Hallazgo critico de revision PR#4 ("'fijar contexto' no persiste ningun
 * contexto"): este endpoint NO guarda una sesion/contexto activo del lado
 * del servidor - eso es una decision de arquitectura, no un descuido
 * (SDD-KAIROS-TRANSVERSAL.md 9.3: "API stateless"), y coincide con como
 * ya quedo implementado del lado del frontend (PR#10/#11: cada pantalla
 * vuelve a resolver y validar el contexto contra el backend en cada
 * operacion, nunca confia en un location.state o "ultimo contexto fijado"
 * sin cruzarlo). El cliente reenvia companyId/branchId en cada request
 * subsecuente, y cada modulo que lo necesite re-valida de forma
 * independiente via WorkContextAuthorizationService (deny-by-default).
 *
 * Este handler existe para 2 cosas concretas, no para persistir estado:
 * (a) devolver un 403 inmediato si el usuario intenta fijar una
 * combinacion que no le pertenece (feedback temprano en TR-05, antes de
 * navegar a TR-06), y (b) dejar el evento auditable que exige el punto 11
 * del contrato (PANTALLAS-V2-B-TRANSVERSAL.md TR-05).
 *
 * Hallazgo critico "auditoria fuera de la transaccion": la validacion y
 * el registro de auditoria se ejecutan dentro de una unica transaccion de
 * base de datos (TransactionManagerPort) - un fallo al auditar revierte
 * tambien la lectura de validacion, y el cliente nunca recibe un 204 que
 * no corresponda exactamente a lo que quedo persistido.
 */
@Injectable()
export class SelectWorkContextHandler {
  constructor(
    private readonly authorization: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: SelectWorkContextCommand): Promise<void> {
    await this.transactionManager.run(async (tx) => {
      const context = await this.authorization.authorize(
        {
          firebaseUid: command.firebaseUid,
          companyId: command.companyId,
          branchId: command.branchId,
        },
        tx,
      );

      await this.auditRepository.recordWorkContextSelection(
        {
          organizationId: context.organizationId,
          firebaseUid: command.firebaseUid,
          companyId: command.companyId,
          branchId: command.branchId,
        },
        tx,
      );
    });
  }
}
