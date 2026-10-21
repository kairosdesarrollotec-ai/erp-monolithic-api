import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';
import { SYNC_FIELD_DATA_TYPES, SYNC_RESOLUTIONS, type SyncFieldDataType, type SyncResolution, type SyncScalar } from '../../../domain/sync-types';

/** Valor escalar del campo (string | number | boolean | null). Se declara aqui para no depender de un validador externo. */
function IsSyncScalar() {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: 'isSyncScalar',
      target: target.constructor,
      propertyName,
      validator: {
        validate(value: unknown): boolean {
          return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 1000);
        },
        defaultMessage(args?: ValidationArguments): string {
          return `${args?.property ?? 'value'} debe ser string (max 1000), numero, booleano o null.`;
        },
      },
    });
  };
}

export class SyncFieldDto {
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/^[A-Za-z0-9_.-]+$/)
  key!: string;

  /** Por defecto CHECKLIST. Los demas tipos se resuelven por la matriz de conflicto (SDD 17.4), no por el cliente. */
  @IsOptional() @IsEnum(SYNC_FIELD_DATA_TYPES)
  dataType?: SyncFieldDataType;

  @IsDefined() @IsSyncScalar()
  value!: SyncScalar;

  /** Revision del campo que el dispositivo vio por ultima vez (0 = nunca sincronizado). */
  @IsInt() @Min(0) @Max(1_000_000)
  baseRev!: number;

  @IsDateString()
  editedAt!: string;
}

export class SyncEvidenceDto {
  /** Idempotencia por captura (uuid generado offline). */
  @IsUUID() clientCaptureId!: string;
  @IsString() @MinLength(1) @MaxLength(60) zone!: string;
  @IsInt() @Min(1) @Max(1000) slot!: number;
  @IsEnum(['PHOTO', 'VIDEO']) type!: 'PHOTO' | 'VIDEO';

  /** SHA-256 hexadecimal del archivo (integridad / anti-duplicado). */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @Matches(/^[a-f0-9]{64}$/)
  contentHash!: string;

  @IsOptional() @IsInt() @Min(0) @Max(52_428_800)
  sizeBytes?: number;

  @IsDateString() capturedAt!: string;
  @IsOptional() @IsString() @MaxLength(100) deviceId?: string;
}

export class SyncChecklistDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsString() @MaxLength(100) deviceId?: string;

  /** Creacion del borrador en el dispositivo (TTL 72 h). */
  @IsDateString() draftCreatedAt!: string;

  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => SyncFieldDto)
  fields!: SyncFieldDto[];

  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SyncEvidenceDto)
  evidence!: SyncEvidenceDto[];
}

export class ResolveSyncConflictDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsEnum(SYNC_RESOLUTIONS) resolution!: SyncResolution;

  /** Opcionales en el DTO a proposito: su ausencia responde 422 (SYNC_REASON_REQUIRED / SYNC_CONFIRMATION_REQUIRED) desde el dominio. */
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  @IsOptional() confirmed?: boolean;
}

export class SyncScopeQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}

export class ListSyncConflictsQueryDto extends SyncScopeQueryDto {
  @IsEnum(['ENTREGA', 'RECEPCION']) checklistType!: 'ENTREGA' | 'RECEPCION';
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsEnum(['OPEN', 'RESOLVED']) status?: 'OPEN' | 'RESOLVED';
}
