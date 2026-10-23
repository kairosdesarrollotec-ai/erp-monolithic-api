import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnZoneMarkRepositoryPort } from '../ports/return-zone-mark-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { InvalidZoneMarkError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import {
  deriveRouteTaken,
  RETURN_ZONE_MARK_VALUES,
  RETURN_ZONE_MARK_ZONES,
  ReturnRouteTaken,
  ReturnZoneMarkRecord,
  ReturnZoneMarkValue,
} from '../../domain/return-zone-marks';
import { RecordZoneMarksCommand } from './record-zone-marks.command';

export interface RecordZoneMarksResult {
  returnId: string;
  marks: ReturnZoneMarkRecord[];
  /** true = las 5 zonas tienen marca. */
  complete: boolean;
  /** Ruta resultante (null mientras falten zonas). */
  route: ReturnRouteTaken | null;
}

/** Las marcas se editan solo durante la inspeccion: una vez resuelta (SIN_DANOS / CON_DANOS) la ruta ya esta tomada. */
const MARKABLE_STATUSES = new Set(['RECEPCION_PROVISIONAL', 'INSPECCION']);

/**
 * DEV-05 / PD-07 (G2, 22-oct-2026) - Persiste en el servidor las marcas "Sin daño"/"Con daño" por zona y emite eventos auditables:
 *  - `RETURN_ZONE_MARKED` por cada zona cuya marca es nueva o cambia (con la marca anterior).
 *  - `RETURN_ROUTE_TAKEN` cuando las 5 zonas quedan marcadas por primera vez o la ruta resultante CAMBIA (sin daño / con daño).
 * Idempotente: repetir las mismas marcas no escribe ni audita nada. Misma autorizacion que completar la inspeccion.
 */
@Injectable()
export class RecordZoneMarksHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly zoneMarks: ReturnZoneMarkRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordZoneMarksCommand): Promise<RecordZoneMarksResult> {
    const { context, scope } = await this.access.authorize(command, 'COMPLETE_INSPECTION');

    const marks = this.validate(command);

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    if (!MARKABLE_STATUSES.has(existing.status)) {
      throw new ReturnStateConflictError('marcar zonas de', existing.status);
    }

    const now = this.clock.now();
    return this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      if (!MARKABLE_STATUSES.has(current.status)) {
        throw new ReturnStateConflictError('marcar zonas de', current.status);
      }

      const before = await this.zoneMarks.list(command.id, tx);
      const previousByZone = new Map(before.map((m) => [m.zone as string, m.mark]));
      const changed = marks.filter((m) => previousByZone.get(m.zone) !== m.mark);
      if (changed.length === 0) {
        return { returnId: command.id, marks: before, complete: deriveRouteTaken(before) !== null, route: deriveRouteTaken(before) };
      }

      const previousRoute = deriveRouteTaken(before);
      await this.zoneMarks.upsertMany({ returnId: command.id, marks: changed, markedBy: command.firebaseUid, markedAt: now }, tx);
      const after = await this.zoneMarks.list(command.id, tx);
      const route = deriveRouteTaken(after);

      for (const mark of changed) {
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: current.rentalId,
            action: 'RETURN_ZONE_MARKED',
            changes: {
              returnId: current.id,
              zone: mark.zone,
              mark: mark.mark,
              previousMark: previousByZone.get(mark.zone) ?? null,
              markedAt: now.toISOString(),
            },
          },
          tx,
        );
      }
      if (route !== null && route !== previousRoute) {
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: current.rentalId,
            action: 'RETURN_ROUTE_TAKEN',
            changes: {
              returnId: current.id,
              route,
              previousRoute,
              damagedZones: after.filter((m) => m.mark === 'DAMAGE').map((m) => m.zone),
              takenAt: now.toISOString(),
            },
          },
          tx,
        );
      }

      return { returnId: command.id, marks: after, complete: route !== null, route };
    });
  }

  private validate(command: RecordZoneMarksCommand): Array<{ zone: string; mark: ReturnZoneMarkValue }> {
    if (command.marks.length === 0) {
      throw new InvalidZoneMarkError('Debe indicar al menos una marca de zona.');
    }
    const seen = new Set<string>();
    const result: Array<{ zone: string; mark: ReturnZoneMarkValue }> = [];
    for (const { zone, mark } of command.marks) {
      if (!(RETURN_ZONE_MARK_ZONES as readonly string[]).includes(zone)) {
        throw new InvalidZoneMarkError(`Zona no válida: ${zone}. Zonas permitidas: ${RETURN_ZONE_MARK_ZONES.join(', ')}.`);
      }
      if (!(RETURN_ZONE_MARK_VALUES as readonly string[]).includes(mark)) {
        throw new InvalidZoneMarkError(`Marca no válida para la zona ${zone}: ${mark}. Valores permitidos: ${RETURN_ZONE_MARK_VALUES.join(', ')}.`);
      }
      if (seen.has(zone)) {
        throw new InvalidZoneMarkError(`La zona ${zone} viene repetida en la misma solicitud.`);
      }
      seen.add(zone);
      result.push({ zone, mark: mark as ReturnZoneMarkValue });
    }
    return result;
  }
}
