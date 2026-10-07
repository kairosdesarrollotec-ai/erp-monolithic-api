import {
  DomainBadRequestError,
  DomainConflictError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainPreconditionError,
} from '../../../common/domain/domain-errors';

/** 404: el rol no existe o no pertenece a la organizacion del admin (IDOR: no se distingue). */
export class RoleNotFoundError extends DomainNotFoundError {
  readonly code = 'ROLE_NOT_FOUND';

  constructor() {
    super('El rol no existe en la organizacion.');
  }
}

/** 400: nombre vacio o de mas de 60 caracteres (despues de recortar espacios). */
export class RoleNameInvalidError extends DomainBadRequestError {
  readonly code = 'ROLE_NAME_INVALID';

  constructor() {
    super('El nombre del rol no puede estar vacio ni superar los 60 caracteres.');
  }
}

/** 409: ya existe un rol con ese nombre en la organizacion (sin distinguir mayusculas). */
export class RoleNameTakenError extends DomainConflictError {
  readonly code = 'ROLE_NAME_TAKEN';

  constructor(name: string) {
    super(`Ya existe un rol llamado "${name}" en la organizacion (no se distinguen mayusculas).`);
  }
}

/** 403: PLATFORM_ADMIN no se renombra ni se desactiva. */
export class RoleNotEditableError extends DomainForbiddenError {
  readonly code = 'ROLE_NOT_EDITABLE';

  constructor() {
    super('El rol PLATFORM_ADMIN es fijo: no se puede renombrar ni desactivar.');
  }
}

/** 409: desactivar un rol con asignaciones activas dejaria usuarios sin rol vigente. */
export class RoleHasActiveAssignmentsError extends DomainConflictError {
  readonly code = 'ROLE_HAS_ACTIVE_ASSIGNMENTS';

  constructor(assignmentCount: number) {
    super(`El rol tiene ${assignmentCount} asignacion(es) activa(s); reasignalas o dalas de baja antes de desactivarlo.`, {
      assignmentCount,
    });
  }
}

/**
 * 409: la operacion dejaria a la organizacion sin ningun rol activo, con
 * asignaciones activas, que tenga a la vez ADMIN.MANAGE_PERMISSIONS y
 * ADMIN.MANAGE_USERS (deadlock operativo: nadie podria volver a gestionar
 * permisos ni usuarios desde la aplicacion).
 */
export class LastAdministratorRoleError extends DomainConflictError {
  readonly code = 'LAST_ADMINISTRATOR_ROLE';

  constructor() {
    super(
      'La operacion dejaria a la organizacion sin ningun rol activo con asignaciones que tenga ADMIN.MANAGE_PERMISSIONS y ADMIN.MANAGE_USERS.',
    );
  }
}

/** 412: If-Match desactualizado (el contrato de roles usa 412, no 409). */
export class RoleVersionConflictError extends DomainPreconditionError {
  readonly code = 'VERSION_CONFLICT';

  constructor() {
    super('El rol fue modificado por otra operacion - vuelve a cargarlo.');
  }
}

/** 400: targetRoleId no existe, esta inactivo o es de otra organizacion (no se distingue: IDOR). */
export class RoleNotAssignableError extends DomainBadRequestError {
  readonly code = 'ROLE_NOT_ASSIGNABLE';

  constructor() {
    super('El rol indicado no existe, esta inactivo o no pertenece a la organizacion del administrador.');
  }
}

/** 409: dos guardados concurrentes de la matriz intentaron la misma version (el cliente recarga y reintenta). */
export class MatrixVersionConflictError extends DomainConflictError {
  readonly code = 'MATRIX_VERSION_CONFLICT';

  constructor() {
    super('Otra persona guardo la matriz al mismo tiempo - recarga la matriz vigente y vuelve a intentarlo.');
  }
}
