export class NotificationTemplateItemResponse {
  eventType!: string;
  version!: number;
  channels!: string[];
  body!: string;
}

export class NotificationTemplateResponse {
  eventType!: string;
  label!: string;
  current!: NotificationTemplateItemResponse | null;
  history!: NotificationTemplateItemResponse[];
}

export class NotificationTemplatesResponse {
  templates!: NotificationTemplateResponse[];
  allowedVariables!: readonly string[];
  channels!: readonly string[];
}
