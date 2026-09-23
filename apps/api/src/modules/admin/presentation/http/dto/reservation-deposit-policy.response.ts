export class ReservationDepositPolicyItem {
  version!: number;
  amount!: string;
  currency!: string;
  effectiveFrom!: string | null;
}

export class ReservationDepositPolicyResponse {
  current!: ReservationDepositPolicyItem;
  history!: ReservationDepositPolicyItem[];
}
