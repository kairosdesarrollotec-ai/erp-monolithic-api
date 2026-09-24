export class AuditEventResponseItem {
  id!: string;
  actorFirebaseUid!: string | null;
  actorEmail!: string | null;
  entityType!: string;
  entityId!: string;
  action!: string;
  changes!: Record<string, unknown> | null;
  createdAt!: string;
}

export class AuditEventsResponse {
  events!: AuditEventResponseItem[];
}
