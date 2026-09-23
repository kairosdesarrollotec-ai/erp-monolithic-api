export class NotificationItemResponse {
  id!: string;
  notificationType!: string;
  isEscalated!: boolean;
  title!: string;
  deepLink!: string;
  readAt!: string | null;
  createdAt!: string;
}

export class NotificationsResponse {
  notifications!: NotificationItemResponse[];
}
