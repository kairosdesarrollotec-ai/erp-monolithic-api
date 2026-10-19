import {
  DomainBadRequestError,
  DomainConflictError,
  DomainNotFoundError,
  DomainPreconditionError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

/** Todos los errores siguen el formato del backend: `{ statusCode, code, detail }` (DomainExceptionFilter). */

export class SyncSourceNotFoundError extends DomainNotFoundError {
  readonly code = 'SYNC_SOURCE_NOT_FOUND';
  constructor(checklistType: string, sourceId: string) {
    super(`No se encontro el expediente ${sourceId} (${checklistType}) en la empresa/sede del usuario.`);
  }
}

export class SyncConflictNotFoundError extends DomainNotFoundError {
  readonly code = 'SYNC_CONFLICT_NOT_FOUND';
  constructor(id: string) {
    super(`Conflicto de sincronizacion ${id} no encontrado.`);
  }
}

/** SDD 17.3: "Expediente ya confirmado/cancelado por otro usuario -> rechazar borrador incompatible". */
export class SyncDraftRejectedError extends DomainConflictError {
  readonly code = 'SYNC_DRAFT_REJECTED';
  constructor(checklistType: string, status: string) {
    super(`El expediente esta en estado ${status}: ya no admite el borrador offline de ${checklistType}. Se rechaza el borrador.`);
  }
}

/** SDD 17.4: TTL de checklist/borrador = 72 h. */
export class SyncDraftExpiredError extends DomainUnprocessableError {
  readonly code = 'SYNC_DRAFT_EXPIRED';
  constructor(ttlHours: number) {
    super(`El borrador offline supero el TTL de ${ttlHours} h y no se puede sincronizar.`);
  }
}

export class SyncPayloadInvalidError extends DomainBadRequestError {
  readonly code = 'SYNC_PAYLOAD_INVALID';
}

/** Matriz SDD 17.4: el pago es exclusivamente online - nunca viaja en una sincronizacion offline. */
export class SyncPaymentOnlineOnlyError extends DomainUnprocessableError {
  readonly code = 'SYNC_PAYMENT_ONLINE_ONLY';
  constructor() {
    super('El pago es exclusivamente online: la fuente financiera siempre prevalece y no se sincroniza desde un borrador offline.');
  }
}

/** Matriz SDD 17.4: datos de empleados (RR.HH.) y borrados criticos (Data Owner) no se resuelven en este contrato. */
export class SyncResolverNotSupportedError extends DomainUnprocessableError {
  readonly code = 'SYNC_RESOLVER_NOT_SUPPORTED';
  constructor(dataType: string, resolver: string) {
    super(`Los conflictos de ${dataType} los resuelve ${resolver} y no forman parte del checklist offline.`);
  }
}

export class SyncConflictAlreadyResolvedError extends DomainConflictError {
  readonly code = 'SYNC_CONFLICT_ALREADY_RESOLVED';
  constructor(id: string) {
    super(`El conflicto ${id} ya fue resuelto.`);
  }
}

export class SyncConflictVersionMismatchError extends DomainPreconditionError {
  readonly code = 'SYNC_CONFLICT_VERSION_MISMATCH';
  constructor() {
    super('El conflicto fue modificado por otra operacion - vuelve a cargarlo.');
  }
}

/** Resolucion sin `confirmed: true` (confirmacion explicita de que version se conserva) - nunca se resuelve sola. */
export class SyncConfirmationRequiredError extends DomainUnprocessableError {
  readonly code = 'SYNC_CONFIRMATION_REQUIRED';
  constructor() {
    super('Resolver un conflicto requiere confirmacion explicita (confirmed=true) de la version que se conserva.');
  }
}

export class SyncReasonRequiredError extends DomainUnprocessableError {
  readonly code = 'SYNC_REASON_REQUIRED';
  constructor(min: number, max: number) {
    super(`El motivo (reason) es obligatorio: entre ${min} y ${max} caracteres.`);
  }
}

/** "Combinar" solo si los campos no chocan: un conflicto de campo SIEMPRE choca. */
export class SyncMergeNotAllowedError extends DomainUnprocessableError {
  readonly code = 'SYNC_MERGE_NOT_ALLOWED';
  constructor(reason: string) {
    super(reason);
  }
}

/** El cierre de la inspeccion/entrega queda bloqueado mientras el servidor no confirme SYNCED. */
export class SyncConflictPendingError extends DomainConflictError {
  readonly code = 'SYNC_CONFLICT_PENDING';
  constructor(checklistType: string, openConflicts: number) {
    super(
      `El checklist de ${checklistType} tiene ${openConflicts} conflicto(s) de sincronizacion sin resolver: el cierre queda bloqueado hasta que el servidor confirme SYNCED.`,
      { openConflicts },
    );
  }
}

/** Reintento del dispositivo con un valor distinto mientras ya hay un conflicto abierto del mismo dato: primero se resuelve. */
export class SyncConflictAlreadyOpenError extends DomainConflictError {
  readonly code = 'SYNC_CONFLICT_ALREADY_OPEN';
  constructor(key: string, conflictId: string) {
    super(`Ya existe un conflicto abierto para ${key} (${conflictId}): resuelvelo antes de volver a sincronizar ese dato.`, { conflictId });
  }
}
