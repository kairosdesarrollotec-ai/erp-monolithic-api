import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * BUS-01 — Tipos de entidad buscables (TDD-BUS-001 §2, BDD-BUS-001 §4).
 * Coincide con SearchEntityType del contrato OpenAPI search.yaml.
 */
export enum SearchEntityTypeDto {
  RENTAL = 'RENTAL',
  RESERVATION = 'RESERVATION',
  CUSTOMER = 'CUSTOMER',
  VEHICLE = 'VEHICLE',
  RETURN = 'RETURN',
}

/**
 * DTO del query string para GET /search (search.yaml — globalSearch).
 * BR-BUS-001: mínimo 2 caracteres.
 * BR-BUS-002: companyId requerido para aislamiento multiempresa.
 * BR-BUS-005: limit máximo 5.
 */
export class SearchQueryDto {
  /** Término de búsqueda. BR-BUS-001: mínimo 2 caracteres. */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  /** Empresa del actor. Validado contra la asignación vigente — nunca se confía ciegamente. */
  @IsString()
  @IsUUID()
  companyId!: string;

  /** Sede del actor (opcional). Cuando se omite, el handler usa companyId como fallback. */
  @IsOptional()
  @IsString()
  @IsUUID()
  branchId?: string;

  /** Máximo de resultados por grupo. Rango 1–5 (BR-BUS-005). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  limit?: number;

  /**
   * Filtrar por tipos de entidad específicos.
   * Acepta array o CSV: types=RENTAL,CUSTOMER (style: form, explode: false).
   */
  @IsOptional()
  @IsArray()
  @IsEnum(SearchEntityTypeDto, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  types?: SearchEntityTypeDto[];
}
