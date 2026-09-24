import { ArrayMinSize, IsArray, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { NOTIFICATION_CHANNELS, NotificationChannel } from '../../../../notification-templates/domain/notification-variable-catalog';

export class SaveNotificationTemplateDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsString() eventType!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(NOTIFICATION_CHANNELS, { each: true })
  channels!: NotificationChannel[];

  @IsString()
  @MaxLength(500)
  body!: string;
}
