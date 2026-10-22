import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { BranchGeofenceRecord, BranchGeofenceRepositoryPort } from '../ports/branch-geofence-repository.port';
import { BranchNotFoundError } from '../../domain/hr-administration-errors';
import { assertValidGeofence } from '../../domain/attendance-self-service-rules';
import { BranchGeofenceRefCommand, SetBranchGeofenceCommand } from './self-attendance.commands';

/**
 * 22-oct (#9): consulta y administra la geocerca (coordenada + radio) de cada sede. Solo quien tenga MANAGE_GEOFENCE
 * (v0: Gerencia y Administracion; editable en ADM-02).
 */
@Injectable()
export class ManageBranchGeofenceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly geofences: BranchGeofenceRepositoryPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async get(command: BranchGeofenceRefCommand): Promise<BranchGeofenceRecord> {
    await this.access.authorize(this.scope(command), 'MANAGE_GEOFENCE');
    const record = await this.geofences.find(command.companyId, command.branchId);
    if (!record) throw new BranchNotFoundError(command.branchId);
    return record;
  }

  async set(command: SetBranchGeofenceCommand): Promise<BranchGeofenceRecord> {
    const { context } = await this.access.authorize(this.scope(command), 'MANAGE_GEOFENCE');
    assertValidGeofence(command);
    const before = await this.geofences.find(command.companyId, command.branchId);
    if (!before) throw new BranchNotFoundError(command.branchId);
    const record = await this.geofences.set(command.companyId, command.branchId, {
      latitude: command.latitude,
      longitude: command.longitude,
      radiusMeters: command.radiusMeters,
      updatedBy: command.firebaseUid,
      updatedAt: this.clock.now(),
    });
    if (!record) throw new BranchNotFoundError(command.branchId);
    await this.auditRepository.recordHrAdministrationEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      entityType: 'branch_geofence',
      entityId: command.branchId,
      action: 'BRANCH_GEOFENCE_SET',
      changes: {
        before: { latitude: before.latitude, longitude: before.longitude, radiusMeters: before.radiusMeters },
        after: { latitude: record.latitude, longitude: record.longitude, radiusMeters: record.radiusMeters },
      },
    });
    return record;
  }

  async clear(command: BranchGeofenceRefCommand): Promise<BranchGeofenceRecord> {
    const { context } = await this.access.authorize(this.scope(command), 'MANAGE_GEOFENCE');
    const before = await this.geofences.find(command.companyId, command.branchId);
    if (!before) throw new BranchNotFoundError(command.branchId);
    const record = await this.geofences.clear(command.companyId, command.branchId, {
      updatedBy: command.firebaseUid,
      updatedAt: this.clock.now(),
    });
    if (!record) throw new BranchNotFoundError(command.branchId);
    await this.auditRepository.recordHrAdministrationEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      entityType: 'branch_geofence',
      entityId: command.branchId,
      action: 'BRANCH_GEOFENCE_CLEARED',
      changes: { before: { latitude: before.latitude, longitude: before.longitude, radiusMeters: before.radiusMeters } },
    });
    return record;
  }

  private scope(c: { firebaseUid: string; companyId: string; branchId: string }) {
    return { firebaseUid: c.firebaseUid, companyId: c.companyId, branchId: c.branchId };
  }
}
