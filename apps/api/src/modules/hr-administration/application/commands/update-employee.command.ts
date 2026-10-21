import type { UpdateEmployeeData } from '../ports/employee-repository.port';

export class UpdateEmployeeCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly data: UpdateEmployeeData,
    /** If-Match (DEC-ADP-EDIT-ETAG-001): versión que el cliente leyó. Opcional por compatibilidad: sin ella no hay control de concurrencia. */
    public readonly expectedVersion?: number,
  ) {}
}
