/**
 * Catálogo y especificación de Formatos Operativos 01-09 del ERP KAIROS/VeloxRent.
 * Fuente: ~/ProjectKairos/formatos/ESTRUCTURA_FORMATOS_01-09.md
 */

export const VEHICLE_OPERATIONAL_FORMATS = [
  'FORMATO_01_FIVI', // Inspección Vehicular Interdiaria
  'FORMATO_02_FIV', // Inspección Vehicular (Entrega/Devolución)
  'FORMATO_03_FITVM', // Inspección Técnica Vehicular Mensual
  'FORMATO_04_FIVUN', // Inspección Técnica Vehicular de Unidad Nueva
  'FORMATO_05_RIO', // Registro de Incidencias y Observaciones
  'FORMATO_06_RNC', // Registro de Nivel de Combustible
  'FORMATO_07_RLV', // Registro de Limpieza Vehicular
  'FORMATO_08_FCKE', // Control de Kit de Emergencia
  'FORMATO_09_MANTENIMIENTO', // Reporte de Mantenimiento
] as const;

export type VehicleOperationalFormatType = (typeof VEHICLE_OPERATIONAL_FORMATS)[number];

export function isValidOperationalFormat(format: string): format is VehicleOperationalFormatType {
  return VEHICLE_OPERATIONAL_FORMATS.includes(format as VehicleOperationalFormatType);
}

/** Periodicidades oficiales de recordatorios (confirmado en prompt R5) */
export const FORMAT_REMINDER_CADENCE_DAYS: Partial<Record<VehicleOperationalFormatType, number>> = {
  FORMATO_01_FIVI: 2, // Interdiaria
  FORMATO_03_FITVM: 30, // Mensual
};
