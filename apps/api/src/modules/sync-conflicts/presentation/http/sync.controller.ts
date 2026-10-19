import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { parseVersionIfMatch } from '../../../../common/http/etag';
import { SyncChecklistHandler } from '../../application/commands/sync-checklist.handler';
import { SyncChecklistCommand } from '../../application/commands/sync-checklist.command';
import { ResolveSyncConflictHandler } from '../../application/commands/resolve-sync-conflict.handler';
import { ResolveSyncConflictCommand } from '../../application/commands/resolve-sync-conflict.command';
import { GetChecklistSyncStatusHandler } from '../../application/queries/get-checklist-sync-status.handler';
import { ListSyncConflictsHandler } from '../../application/queries/list-sync-conflicts.handler';
import { GetChecklistSyncStatusQuery, ListSyncConflictsQuery } from '../../application/queries/sync-queries';
import { SYNC_CHECKLIST_TYPES, type SyncChecklistType } from '../../domain/sync-types';
import type { IncomingField } from '../../domain/sync-conflict-matrix';
import type { IncomingEvidence } from '../../domain/sync-evidence-merge';
import {
  ListSyncConflictsQueryDto,
  ResolveSyncConflictDto,
  SyncChecklistDto,
  SyncScopeQueryDto,
} from './dto/sync-checklist.dto';
import type {
  ResolveSyncConflictResponse,
  SyncChecklistResponse,
  SyncChecklistResultResponse,
  SyncConflictResponse,
} from './dto/sync.response';
import {
  toResolveSyncConflictResponse,
  toSyncChecklistResponse,
  toSyncChecklistResultResponse,
  toSyncConflictResponse,
} from './sync.mapper';

const checklistTypePipe = new ParseEnumPipe(Object.fromEntries(SYNC_CHECKLIST_TYPES.map((t) => [t, t])));

/**
 * TR-08 (Centro de sincronizacion) / ENTREGA-04 / DEV-04 - contrato backend de conflictos de sincronizacion offline
 * (SDD-KAIROS-TRANSVERSAL 17.3-17.4). Todos los POST aceptan `Idempotency-Key`; resolver exige `If-Match` con la version
 * del conflicto. Errores `{statusCode, code, detail}`.
 */
@Controller('sync')
@UseGuards(FirebaseAuthGuard)
export class SyncController {
  constructor(
    private readonly syncChecklist: SyncChecklistHandler,
    private readonly resolveConflict: ResolveSyncConflictHandler,
    private readonly getStatus: GetChecklistSyncStatusHandler,
    private readonly listConflicts: ListSyncConflictsHandler,
  ) {}

  @Post('checklists/:checklistType/:sourceId/commands/sync')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async sync(
    @Req() req: AuthenticatedRequest,
    @Param('checklistType', checklistTypePipe) checklistType: SyncChecklistType,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() dto: SyncChecklistDto,
  ): Promise<SyncChecklistResultResponse> {
    const fields: IncomingField[] = dto.fields.map((f) => ({
      key: f.key,
      dataType: f.dataType ?? 'CHECKLIST',
      value: f.value,
      baseRev: f.baseRev,
      editedAt: f.editedAt,
    }));
    const evidence: IncomingEvidence[] = dto.evidence.map((e) => ({
      clientCaptureId: e.clientCaptureId,
      zone: e.zone,
      slot: e.slot,
      type: e.type,
      contentHash: e.contentHash,
      sizeBytes: e.sizeBytes ?? null,
      capturedAt: e.capturedAt,
      deviceId: e.deviceId ?? dto.deviceId ?? null,
    }));
    const result = await this.syncChecklist.execute(
      new SyncChecklistCommand(
        checklistType,
        sourceId,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.deviceId ?? null,
        new Date(dto.draftCreatedAt),
        fields,
        evidence,
      ),
    );
    return toSyncChecklistResultResponse(result);
  }

  @Get('checklists/:checklistType/:sourceId')
  async status(
    @Req() req: AuthenticatedRequest,
    @Param('checklistType', checklistTypePipe) checklistType: SyncChecklistType,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Query() query: SyncScopeQueryDto,
  ): Promise<SyncChecklistResponse> {
    const result = await this.getStatus.execute(
      new GetChecklistSyncStatusQuery(checklistType, sourceId, req.firebaseUid!, query.companyId, query.branchId),
    );
    return toSyncChecklistResponse(result);
  }

  @Get('conflicts')
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListSyncConflictsQueryDto): Promise<SyncConflictResponse[]> {
    const rows = await this.listConflicts.execute(
      new ListSyncConflictsQuery(
        query.checklistType,
        req.firebaseUid!,
        query.companyId,
        query.branchId,
        query.sourceId,
        query.status ?? 'OPEN',
      ),
    );
    return rows.map(toSyncConflictResponse);
  }

  @Post('conflicts/:conflictId/commands/resolve')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param('conflictId', ParseUUIDPipe) conflictId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ResolveSyncConflictDto,
  ): Promise<ResolveSyncConflictResponse> {
    const result = await this.resolveConflict.execute(
      new ResolveSyncConflictCommand(
        conflictId,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        parseVersionIfMatch(ifMatch),
        dto.resolution,
        dto.reason,
        dto.confirmed,
      ),
    );
    return toResolveSyncConflictResponse(result);
  }
}
