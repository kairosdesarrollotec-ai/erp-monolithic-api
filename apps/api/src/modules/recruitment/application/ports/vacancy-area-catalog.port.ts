/** Area oficial del catalogo hr_areas de una empresa. */
export interface VacancyCatalogArea {
  code: string;
  name: string;
}

/**
 * 22-oct (P2): el area (`department`) de una vacante debe existir y estar ACTIVA en el catalogo de areas de la empresa
 * (hr_areas, Respuestas #17). Reclutamiento solo LEE ese catalogo; la administracion de areas es de Personal.
 */
export abstract class VacancyAreaCatalogPort {
  /** Area activa de la empresa que corresponde al texto (nombre, codigo o alias como «RRHH»); null si no existe. */
  abstract resolveActive(operatingCompanyId: string, text: string): Promise<VacancyCatalogArea | null>;
}
