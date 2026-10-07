export const INTERVIEWERS_DEFAULT_LIMIT = 20;
export const INTERVIEWERS_MAX_LIMIT = 50;

export class ListInterviewersQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly search?: string,
    public readonly limit?: number,
  ) {}
}
