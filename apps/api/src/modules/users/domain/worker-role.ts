/**
 * PROVISIONAL (HU-24/TR-06): union minima de roles para poder enrutar al
 * tablero correcto. El modelo definitivo de roles y permisos vive en
 * ADM-02 (matriz rol-accion-empresa-sede versionada, todavia no
 * construida) - este tipo se reemplaza cuando ADM-02 exista, no es el
 * modelo final. Los 7 valores corresponden 1:1 a los 7 prototipos
 * aprobados de TR-06 en docs/prototype-manifest.yaml.
 */
export type WorkerRole =
  | 'ADMINISTRACION'
  | 'AUDITORIA'
  | 'CAMPO'
  | 'FINANZAS'
  | 'FRONT_OFFICE'
  | 'GERENCIA'
  | 'RRHH';
