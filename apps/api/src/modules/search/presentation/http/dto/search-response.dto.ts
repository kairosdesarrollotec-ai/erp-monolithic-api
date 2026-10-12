/**
 * BUS-01 — DTOs de respuesta para GET /search (search.yaml — SearchResponse).
 * Solo tipado de salida; no requiere decoradores de validación.
 */

export type SearchEntityTypeResponse = 'RENTAL' | 'RESERVATION' | 'CUSTOMER' | 'VEHICLE' | 'RETURN';

/** search.yaml → SearchResultItem */
export interface SearchResultItemResponse {
  id: string;
  type: SearchEntityTypeResponse;
  title: string;
  subtitle: string | null;
  route: string;
}

/** search.yaml → SearchResultGroup */
export interface SearchResultGroupResponse {
  type: SearchEntityTypeResponse;
  label: string;
  results: SearchResultItemResponse[];
}

/** search.yaml → SearchResponse */
export interface SearchResponseDto {
  query: string;
  groups: SearchResultGroupResponse[];
  totalGroups: number;
  generatedAt: string;
}
