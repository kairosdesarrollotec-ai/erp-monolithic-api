# Runbook — saneamiento de solapamientos de compromisos de vehículo

## Propósito

La migración `20261022030001_vehicle_commitments_no_overlap` protege la regla NFR-KAI-001: un vehículo no puede tener dos compromisos `ACTIVE` o `CONSOLIDATED` cuyos períodos `[starts_at, ends_at)` se solapen.

La migración aborta si encuentra datos históricos incompatibles. No se debe ignorar ese error ni marcar manualmente la migración como aplicada.

## Procedimiento

1. Detener el despliegue que falló. No ejecutar `prisma migrate resolve --applied`.
2. Con una conexión administrativa de solo lectura, identificar los pares conflictivos:

   ```sql
   SELECT
     a.id AS commitment_a,
     b.id AS commitment_b,
     a.vehicle_id,
     a.source_type AS source_type_a,
     a.source_id AS source_id_a,
     b.source_type AS source_type_b,
     b.source_id AS source_id_b,
     a.starts_at AS starts_at_a,
     a.ends_at AS ends_at_a,
     b.starts_at AS starts_at_b,
     b.ends_at AS ends_at_b
   FROM vehicle_commitments a
   JOIN vehicle_commitments b
     ON a.vehicle_id = b.vehicle_id
    AND a.id < b.id
    AND a.status IN ('ACTIVE', 'CONSOLIDATED')
    AND b.status IN ('ACTIVE', 'CONSOLIDATED')
    AND a.starts_at < a.ends_at
    AND b.starts_at < b.ends_at
    AND tsrange(a.starts_at, a.ends_at, '[)') && tsrange(b.starts_at, b.ends_at, '[)');
   ```

3. Para cada par, la persona responsable de Operaciones determina cuál es el compromiso válido. Libera o cancela el registro incorrecto mediante el flujo de negocio correspondiente; no borres filas directamente.
4. Repetir la consulta hasta obtener cero filas. Adjuntar el resultado y la decisión operativa al ticket de despliegue.
5. Si Prisma dejó un registro de migración fallida, usar el procedimiento de rollback establecido para el ambiente y recién entonces reintentar `prisma migrate deploy` desde CD.
6. Verificar que la constraint exista:

   ```sql
   SELECT conname
   FROM pg_constraint
   WHERE conname = 'vehicle_commitments_no_overlap_excl';
   ```

## Criterio de salida

El despliegue solo se considera correcto cuando no hay pares solapados y la consulta de verificación devuelve exactamente la constraint `vehicle_commitments_no_overlap_excl`.
