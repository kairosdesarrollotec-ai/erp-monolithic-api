import type { VacationStatus } from '@prisma/client';

export class ResolveVacationCommand {
  constructor(
    readonly firebaseUid: string,
    readonly vacationId: string,
    readonly status: VacationStatus,
    readonly grantedDays?: number | null,
    readonly statusReason?: string | null,
  ) {}
}
