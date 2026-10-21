import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  EVIDENCE_DELETION_STATUSES,
  EVIDENCE_DELETION_TARGET_KINDS,
  type EvidenceDeletionStatus,
  type EvidenceDeletionTargetKind,
} from '../../../domain/evidence-deletion-types';
import { EVIDENCE_DELETION_MAX_REASON_LENGTH, EVIDENCE_DELETION_MIN_REASON_LENGTH } from '../../../domain/evidence-deletion-errors';

export class RequestEvidenceDeletionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** RENTAL = evidencia de la entrega de un alquiler; RETURN = evidencia de la recepcion de una devolucion. */
  @IsEnum(EVIDENCE_DELETION_TARGET_KINDS) targetKind!: EvidenceDeletionTargetKind;

  /** rentalId (RENTAL) o returnId (RETURN). */
  @IsUUID() targetId!: string;
  @IsUUID() evidenceId!: string;

  @IsString() @MinLength(EVIDENCE_DELETION_MIN_REASON_LENGTH) @MaxLength(EVIDENCE_DELETION_MAX_REASON_LENGTH)
  reason!: string;
}

export class ApproveEvidenceDeletionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(EVIDENCE_DELETION_MAX_REASON_LENGTH)
  note?: string;
}

export class RejectEvidenceDeletionDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsString() @MinLength(EVIDENCE_DELETION_MIN_REASON_LENGTH) @MaxLength(EVIDENCE_DELETION_MAX_REASON_LENGTH)
  reason!: string;
}

export class EvidenceDeletionScopeQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}

export class ListEvidenceDeletionQueryDto extends EvidenceDeletionScopeQueryDto {
  @IsOptional() @IsEnum(EVIDENCE_DELETION_STATUSES) status?: EvidenceDeletionStatus;
  @IsOptional() @IsEnum(EVIDENCE_DELETION_TARGET_KINDS) targetKind?: EvidenceDeletionTargetKind;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
