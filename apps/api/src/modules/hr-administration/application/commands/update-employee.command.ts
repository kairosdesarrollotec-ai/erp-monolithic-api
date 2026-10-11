import type { UpdateEmployeeData } from '../ports/employee-repository.port';

export class UpdateEmployeeCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly data: UpdateEmployeeData,
  ) {}
}
