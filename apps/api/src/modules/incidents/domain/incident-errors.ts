import {
  DomainConflictError,
  DomainError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainUnprocessableError,
} from '../../../common/domain/domain-errors';

export class IncidentNotFoundError extends DomainNotFoundError {
  readonly code = 'INCIDENT_NOT_FOUND';

  constructor(id?: string) {
    super(id ? `Incidencia ${id} no encontrada.` : 'Incidencia no encontrada.');
  }
}

/** Contrato incidents.yaml: la version desactualizada (If-Match) responde 409 VERSION_CONFLICT. */
export class IncidentVersionConflictError extends DomainConflictError {
  readonly code = 'VERSION_CONFLICT';

  constructor() {
    super('La incidencia fue modificada por otra operacion - vuelve a cargarla.');
  }
}

/** ABIERTA es el unico estado que admite acciones, resolucion, cierre o derivacion; CERRADA y VIA_LEGAL son terminales. */
export class IncidentNotOpenError extends DomainConflictError {
  readonly code = 'INCIDENT_NOT_OPEN';

  constructor(status: string) {
    super(`La incidencia esta en estado ${status} y ya no admite cambios.`);
  }
}

/** INC-01: "Resolver" directo solo para severidad LEVE; MODERADA/GRAVE exigen cerrar desde el detalle (INC-02). */
export class IncidentDirectResolveNotAllowedError extends DomainUnprocessableError {
  readonly code = 'INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED';

  constructor(severity: string) {
    super(
      `Una incidencia de severidad ${severity} no admite resolucion directa; abre el detalle y usa "Cerrar incidencia" (INC-01/INC-02).`,
    );
  }
}

/** DEC-ALQ-UNAUTH-DRIVER-003: el tipo admite solo ciertas severidades (conductor no autorizado = GRAVE). */
export class IncidentSeverityNotAllowedForTypeError extends DomainUnprocessableError {
  readonly code = 'INCIDENT_SEVERITY_NOT_ALLOWED_FOR_TYPE';

  constructor(type: string, severity: string, allowed: readonly string[]) {
    super(`Una incidencia de tipo ${type} no admite severidad ${severity}; use ${allowed.join(' / ')}.`);
  }
}

/** DEC-ALQ-UNAUTH-DRIVER-003: la decision sobre esta incidencia la toma Gerencia caso por caso. */
export class IncidentManagementDecisionRequiredError extends DomainForbiddenError {
  readonly code = 'MANAGEMENT_DECISION_REQUIRED';

  constructor(type: string) {
    super(`La decision sobre una incidencia de tipo ${type} (resolver, cerrar o derivar a via legal) la toma solo Gerencia, caso por caso.`);
  }
}

export class IncidentRentalNotFoundError extends DomainNotFoundError {
  readonly code = 'RENTAL_NOT_FOUND';

  constructor(rentalId?: string) {
    super(rentalId ? `Alquiler ${rentalId} no encontrado en la empresa/sede.` : 'Alquiler no encontrado en la empresa/sede.');
  }
}

export class IncidentReturnNotFoundError extends DomainNotFoundError {
  readonly code = 'RETURN_NOT_FOUND';

  constructor(returnId?: string, detail?: string) {
    super(detail ?? (returnId ? `Devolucion ${returnId} no encontrada en la empresa/sede.` : 'Devolucion no encontrada en la empresa/sede.'));
  }
}

/** Texto obligatorio vacio o solo espacios (resumen, motivo, descripcion): 400, igual que un DTO invalido. */
export class IncidentInvalidTextError extends DomainError {
  readonly code = 'INCIDENT_TEXT_REQUIRED';
  readonly httpStatus = 400;

  constructor(field: string) {
    super(`El campo ${field} es obligatorio y no puede estar vacio.`);
  }
}
