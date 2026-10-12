/**
 * BUS-01 — Dominio de Búsqueda Global (TDD-BUS-001 §4).
 * Solo lectura — sin estado mutable, sin comandos de dominio.
 * No depende de NestJS, Prisma, Firebase ni HTTP.
 */
export type SearchEntityType = 'RENTAL' | 'RESERVATION' | 'CUSTOMER' | 'VEHICLE' | 'RETURN';

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  /** Identificador principal legible: nombre cliente, placa vehículo, etc. */
  title: string;
  /** Información secundaria de contexto (nullable). BR-BUS-008: sin biometría ni datos sensibles. */
  subtitle: string | null;
  /** Ruta frontend para navegar al detalle. BR-BUS-006. */
  route: string;
}

export interface SearchResultGroup {
  type: SearchEntityType;
  label: string;
  results: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  /** Máximo 3 grupos (BR-BUS-005). */
  groups: SearchResultGroup[];
  totalGroups: number;
  generatedAt: string;
}

export const ENTITY_LABELS: Record<SearchEntityType, string> = {
  RENTAL: 'Alquileres',
  RESERVATION: 'Reservas',
  CUSTOMER: 'Clientes',
  VEHICLE: 'Vehículos',
  RETURN: 'Devoluciones',
};

export const ENTITY_ROUTES: Record<SearchEntityType, (id: string) => string> = {
  RENTAL: (id) => `/rentals/${id}`,
  RESERVATION: (id) => `/reservations/${id}`,
  CUSTOMER: (id) => `/customers/${id}`,
  VEHICLE: (id) => `/fleet/vehicles/${id}`,
  RETURN: (id) => `/returns/${id}`,
};
