import { Injectable, Logger } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { LoginFailureScope, LoginFailureTrackerPort } from '../../application/ports/login-failure-tracker.port';
import { LOGIN_FAILURE_ALERT_ACTION } from '../../domain/login-failure-policy';

@Injectable()
export class PrismaLoginFailureTracker implements LoginFailureTrackerPort {
  private readonly logger = new Logger(PrismaLoginFailureTracker.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAttemptsSince(email: string, since: Date, limit: number): Promise<Array<{ outcome: 'SUCCESS' | 'FAILURE' }>> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { entityType: 'auth', entityId: email, action: 'LOGIN_ATTEMPT', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { changes: true },
    });
    return rows.map((r) => ({
      outcome: (r.changes as { outcome?: string } | null)?.outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
    }));
  }

  async alertAlreadyRaised(email: string, since: Date): Promise<boolean> {
    const count = await this.prisma.auditEvent.count({
      where: { entityType: 'auth', entityId: email, action: LOGIN_FAILURE_ALERT_ACTION, createdAt: { gte: since } },
    });
    return count > 0;
  }

  async resolveScopes(email: string): Promise<LoginFailureScope[]> {
    let uid: string;
    try {
      initFirebaseAdmin();
      uid = (await getAuth().getUserByEmail(email)).uid;
    } catch {
      return [];
    }
    const now = new Date();
    const rows = await this.prisma.userCompanyAssignment.findMany({
      where: { firebaseUid: uid, active: true, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      select: { organizationId: true, companyId: true, branchId: true },
    });
    return rows.map((r) => ({ organizationId: r.organizationId, operatingCompanyId: r.companyId, branchId: r.branchId }));
  }

  async raiseAlert(input: { email: string; failures: number; windowMinutes: number; scopes: LoginFailureScope[]; now: Date }): Promise<void> {
    const orgs = [...new Set(input.scopes.map((s) => s.organizationId))];
    const eventOrgs = orgs.length > 0 ? orgs : ['UNKNOWN'];
    await this.prisma.auditEvent.createMany({
      data: eventOrgs.map((organizationId) => ({
        organizationId,
        actorUserId: null,
        entityType: 'auth',
        entityId: input.email,
        action: LOGIN_FAILURE_ALERT_ACTION,
        changes: { failures: input.failures, windowMinutes: input.windowMinutes },
      })),
    });
    if (input.scopes.length === 0) {
      this.logger.warn(`Fallos de login >= umbral para un identificador sin cuenta conocida (${input.failures}).`);
      return;
    }
    const bucket = Math.floor(input.now.getTime() / (input.windowMinutes * 60_000));
    await this.prisma.dashboardItem.createMany({
      data: input.scopes.map((s) => ({
        organizationId: s.organizationId,
        operatingCompanyId: s.operatingCompanyId,
        branchId: s.branchId,
        role: 'ADMINISTRACION' as const,
        itemType: 'ALERT',
        priority: 90,
        title: 'Intentos de acceso fallidos repetidos',
        detail: `${input.failures} fallos consecutivos de inicio de sesion en ${input.windowMinutes} min para ${input.email}. Acceso bloqueado temporalmente por 15 min; revise el registro de auditoria.`,
        deepLink: '/administracion/auditoria',
        sourceType: 'SECURITY',
        sourceId: input.email,
        sourceEventId: `login-failures:${input.email}:${s.organizationId}:${s.operatingCompanyId}:${s.branchId}:${bucket}`,
      })),
      skipDuplicates: true,
    });
  }
}
