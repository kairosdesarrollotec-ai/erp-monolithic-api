import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReminderRunSummary {
  created: number;
  markedOverdue: number;
}

@Injectable()
export class VehicleFormatReminderScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
    private readonly outbox: OutboxEventRepositoryPort,
  ) {}

  async run(companyId: string, organizationId: string): Promise<ReminderRunSummary> {
    const now = this.clock.now();
    let created = 0;
    let markedOverdue = 0;

    // 1. Marcar como OVERDUE recordatorios vencidos
    const overdueReminders = await this.prisma.vehicleFormatReminder.findMany({
      where: {
        operatingCompanyId: companyId,
        status: 'PENDING',
        dueDate: { lt: now },
      },
    });

    for (const rem of overdueReminders) {
      await this.prisma.vehicleFormatReminder.update({
        where: { id: rem.id },
        data: { status: 'OVERDUE', updatedAt: now },
      });
      markedOverdue++;

      // Notificación in-app a Gerencia cuando un recordatorio queda vencido (R5)
      await this.outbox.publish({
        aggregateType: 'FLEET',
        aggregateId: rem.vehicleId,
        eventType: 'RecordatorioFormatoVencido.v1',
        payload: {
          reminderId: rem.id,
          vehicleId: rem.vehicleId,
          formatType: rem.formatType,
          dueDate: rem.dueDate.toISOString(),
          companyId,
          organizationId,
        },
      });
    }

    // 2. Generar recordatorios si faltan para vehículos activos
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        operatingCompanyId: companyId,
        status: { in: ['AVAILABLE', 'RENTED', 'MAINTENANCE'] },
      },
    });

    for (const v of vehicles) {
      // FIVI (interdiaria = cada 2 días)
      const openFivi = await this.prisma.vehicleFormatReminder.findFirst({
        where: {
          vehicleId: v.id,
          formatType: 'FORMATO_01_FIVI',
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      });

      if (!openFivi) {
        const lastFivi = await this.prisma.vehicleOperationalRecord.findFirst({
          where: { vehicleId: v.id, formatType: 'FORMATO_01_FIVI' },
          orderBy: { performedAt: 'desc' },
        });

        const lastDate = lastFivi?.performedAt ?? v.createdAt;
        if (now.getTime() - lastDate.getTime() >= 2 * MS_PER_DAY) {
          const dueDate = new Date(now.getTime() + 2 * MS_PER_DAY);
          const rem = await this.prisma.vehicleFormatReminder.create({
            data: {
              organizationId,
              operatingCompanyId: companyId,
              branchId: v.branchId ?? '',
              vehicleId: v.id,
              formatType: 'FORMATO_01_FIVI',
              dueDate,
              status: 'PENDING',
            },
          });
          created++;

          await this.outbox.publish({
            aggregateType: 'FLEET',
            aggregateId: v.id,
            eventType: 'RecordatorioFiviGenerado.v1',
            payload: {
              reminderId: rem.id,
              vehicleId: v.id,
              dueDate: dueDate.toISOString(),
              companyId,
              organizationId,
            },
          });
        }
      }

      // FITVM (mensual = cada 30 días)
      const openFitvm = await this.prisma.vehicleFormatReminder.findFirst({
        where: {
          vehicleId: v.id,
          formatType: 'FORMATO_03_FITVM',
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      });

      if (!openFitvm) {
        const lastFitvm = await this.prisma.vehicleOperationalRecord.findFirst({
          where: { vehicleId: v.id, formatType: 'FORMATO_03_FITVM' },
          orderBy: { performedAt: 'desc' },
        });

        const lastDate = lastFitvm?.performedAt ?? v.createdAt;
        if (now.getTime() - lastDate.getTime() >= 30 * MS_PER_DAY) {
          const dueDate = new Date(now.getTime() + 30 * MS_PER_DAY);
          const rem = await this.prisma.vehicleFormatReminder.create({
            data: {
              organizationId,
              operatingCompanyId: companyId,
              branchId: v.branchId ?? '',
              vehicleId: v.id,
              formatType: 'FORMATO_03_FITVM',
              dueDate,
              status: 'PENDING',
            },
          });
          created++;

          await this.outbox.publish({
            aggregateType: 'FLEET',
            aggregateId: v.id,
            eventType: 'RecordatorioFitvmGenerado.v1',
            payload: {
              reminderId: rem.id,
              vehicleId: v.id,
              dueDate: dueDate.toISOString(),
              companyId,
              organizationId,
            },
          });
        }
      }
    }

    return { created, markedOverdue };
  }
}
