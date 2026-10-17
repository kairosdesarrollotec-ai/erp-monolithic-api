export type ReturnAlertType = 'WARRANTY_RELEASE' | 'IMMOBILIZATION';
export const RETURN_ALERT_TYPES: readonly ReturnAlertType[] = ['WARRANTY_RELEASE', 'IMMOBILIZATION'];

export const RETURN_ALERT_LIST_DEFAULT_LIMIT = 100;
export const RETURN_ALERT_LIST_MAX_LIMIT = 200;

export class ListReturnAlertsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Sin tipo = ambos. */
    public readonly type?: ReturnAlertType,
    public readonly limit: number = RETURN_ALERT_LIST_DEFAULT_LIMIT,
  ) {}
}
