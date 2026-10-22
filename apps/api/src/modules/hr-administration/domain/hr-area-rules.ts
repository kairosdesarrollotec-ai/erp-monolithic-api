/**
 * H-02 / DEC-ADP-AREAS-001..003: normalizacion de areas de RR.HH. Es la MISMA regla que usa el front (`areaIdFromName`) para
 * derivar el id de un area nueva, de modo que "Operaciones", "OPERACIONES " y "operaciónes" no partan el cupo de vacaciones
 * del area (BR-ADP-002, que compara `areaId` por igualdad).
 */

/** Texto del area sin tildes ni mayusculas, solo [A-Z0-9] separados por un espacio. Sirve para comparar nombres. */
export function normalizeAreaText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Codigo estable derivado del texto (mayusculas, sin tildes, `_`). Idempotente sobre un codigo ya canonico. */
export function areaCodeFromText(value: string): string {
  return normalizeAreaText(value).replace(/ /g, '_');
}

/**
 * Respuestas 2026-10-20 #17: catalogo oficial de areas (7 del organigrama del 17-ago + Gerencia General/Subgerencia + Gestion y
 * Procesos). NO incluye «Contabilidad externa» (no es seleccionable). Fuente unica: la usan la semilla de empresa nueva, la
 * migracion (espejo en SQL) y las pruebas.
 */
export interface DefaultHrArea {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
}

export const DEFAULT_HR_AREAS: readonly DefaultHrArea[] = [
  { code: 'ADMINISTRACION', name: 'Administración', description: 'Órgano de apoyo: gestión administrativa de la empresa', sortOrder: 10 },
  { code: 'TALENTO_HUMANO', name: 'Talento Humano', description: 'Órgano de apoyo: nombre formal de Recursos Humanos', sortOrder: 20 },
  { code: 'SERVICIOS_GENERALES', name: 'Servicios Generales', description: 'Órgano de apoyo: limpieza y áreas afines', sortOrder: 30 },
  { code: 'DESARROLLO_DE_TECNOLOGIA', name: 'Desarrollo de Tecnología', description: 'Órgano de apoyo: antes «Tecnología VeloxRent»; aquí encaja el proyecto Kairos', sortOrder: 40 },
  { code: 'ATENCION_AL_CLIENTE', name: 'Atención al cliente', description: 'Órgano de línea', sortOrder: 50 },
  { code: 'MARKETING', name: 'Marketing', description: 'Órgano de línea', sortOrder: 60 },
  { code: 'OPERACIONES', name: 'Operaciones', description: 'Órgano de línea', sortOrder: 70 },
  { code: 'GERENCIA_GENERAL', name: 'Gerencia General / Subgerencia', description: 'Dirección de la empresa (Gerencia General y Subgerencia)', sortOrder: 80 },
  { code: 'GESTION_Y_PROCESOS', name: 'Gestión y Procesos', description: 'Gestión de procesos de la empresa', sortOrder: 90 },
];

/**
 * Alias de escritura -> codigo de catalogo (Respuestas #17: «RRHH» / «Recursos Humanos» se mapean a Talento Humano).
 * Las llaves son texto ya normalizado con `normalizeAreaText`.
 */
const AREA_TEXT_ALIASES: Readonly<Record<string, string>> = {
  RRHH: 'TALENTO_HUMANO',
  'RR HH': 'TALENTO_HUMANO',
  'RECURSOS HUMANOS': 'TALENTO_HUMANO',
  'GESTION DE TALENTO HUMANO': 'TALENTO_HUMANO',
  'GERENCIA GENERAL': 'GERENCIA_GENERAL',
  'GESTION Y PROCESOS': 'GESTION_Y_PROCESOS',
};

/** Codigo de catalogo al que apunta un texto libre que es alias conocido (o `undefined`). */
export function areaAliasCode(value: string): string | undefined {
  return AREA_TEXT_ALIASES[normalizeAreaText(value)];
}

/** Codigo para FILTRAR por area: alias conocido («RRHH» -> TALENTO_HUMANO) o el codigo derivado del texto. */
export function areaFilterCode(value: string): string {
  return areaAliasCode(value) ?? areaCodeFromText(value);
}

export interface CatalogAreaLike {
  code: string;
  name: string;
}

/**
 * 22-oct: busca en el catalogo ACTIVO de una empresa el area que corresponde a un texto libre: por nombre oficial, por codigo
 * (derivado del texto) o por alias conocido («RRHH» -> Talento Humano), sin distinguir mayusculas ni tildes. Devuelve `undefined` si
 * no hay coincidencia. Misma regla de emparejamiento que `HrAreaResolverService`; la usa Reclutamiento para validar el area de la vacante.
 */
export function matchAreaInCatalog<T extends CatalogAreaLike>(catalog: readonly T[], text: string): T | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const nameKey = normalizeAreaText(trimmed);
  const codeKey = areaCodeFromText(trimmed);
  const aliasCode = areaAliasCode(trimmed);
  return (
    catalog.find((a) => normalizeAreaText(a.name) === nameKey) ??
    catalog.find((a) => a.code === codeKey) ??
    (aliasCode ? catalog.find((a) => a.code === aliasCode) : undefined)
  );
}
