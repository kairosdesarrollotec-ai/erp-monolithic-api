import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GetMyNotificationsHandler } from '../../application/queries/get-my-notifications.handler';
import { GetMyNotificationsQuery } from '../../application/queries/get-my-notifications.query';
import { MarkAllNotificationsReadHandler } from '../../application/commands/mark-all-notifications-read.handler';
import { MarkAllNotificationsReadCommand } from '../../application/commands/mark-all-notifications-read.command';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { GetMyNotificationsQueryDto } from './dto/get-my-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { NotificationsResponse } from './dto/notification.response';

/**
 * TR-07 (Centro de notificaciones, PANTALLAS-V2-B-TRANSVERSAL.md).
 * "Todos - cada uno ve solo sus propias notificaciones" (contrato punto
 * 3) - no hay guarda de rol especifica, el filtro real es que el
 * destinatario siempre es el propio usuario autenticado (ver
 * GetMyNotificationsHandler).
 */
@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly getMyNotifications: GetMyNotificationsHandler,
    private readonly markAllNotificationsRead: MarkAllNotificationsReadHandler,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetMyNotificationsQueryDto,
  ): Promise<NotificationsResponse> {
    const notifications = await this.getMyNotifications.execute(
      new GetMyNotificationsQuery(req.firebaseUid!, query.companyId, query.branchId, query.unreadOnly === 'true'),
    );
    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        notificationType: n.notificationType,
        isEscalated: n.isEscalated,
        title: n.title,
        deepLink: n.deepLink,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@Req() req: AuthenticatedRequest, @Body() dto: MarkAllNotificationsReadDto): Promise<void> {
    await this.markAllNotificationsRead.execute(
      new MarkAllNotificationsReadCommand(req.firebaseUid!, dto.companyId, dto.branchId),
    );
  }
}
