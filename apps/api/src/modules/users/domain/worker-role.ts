/**
 * PROVISIONAL (HU-24/TR-06): union minima de roles para poder enrutar al
 * tablero correcto. El modelo definitivo de roles y permisos vive en
 * ADM-02 (matriz rol-accion-empresa-sede versionada, todavia no
 * construida) - este tipo se reemplaza cuando ADM-02 exista, no es el
 * modelo final. Los 7 valores corresponden 1:1 a los 7 prototipos
 * aprobados de TR-06 en docs/prototype-manifest.yaml.
 *
 * Hallazgo medio de revision PR#5 ("duplicacion manual del enum" - el rol
 * se replica en Prisma, dominio y OpenAPI, con riesgo de divergencia
 * silenciosa): `WORKER_ROLES` es el array de valores en tiempo de
 * ejecucion que respalda este tipo, y es la unica fuente que
 * worker-role.equivalence.spec.ts usa para verificar automaticamente que
 * apps/api/prisma/schema.prisma (enum WorkerRole) y
 * packages/contracts/openapi/transversal.yaml (schema WorkerRole) no se
 * hayan desalineado. No reemplaza generar el tipo desde el cliente
 * Prisma real (bloqueado hoy porque este entorno no tiene red hacia
 * binaries.prisma.sh, ver PROP-003/NOTA-PROP-003 en docs/decision-log.md)
 * - eso queda pendiente para cuando haya red completa.
 */
export const WORKER_ROLES = [
  'ADMINISTRACION',
  'AUDITORIA',
  'CAMPO',
  'FINANZAS',
  'FRONT_OFFICE',
  'GERENCIA',
  'RRHH',
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];
