# Baseline de migraciones Prisma - procedimiento para entornos existentes

Hallazgo ALTO de la revision de seguimiento de PR#4 (revalidacion de
`9e33c4f`, PR
[#4](https://github.com/kairosdesarrollotec-ai/erp-monolithic-api/pull/4)):
la migracion `20260918000000_init` fue escrita a mano y captura el
schema completo tal como quedo despues de aplicarse originalmente con
`prisma db push` (sin historial de migraciones). Cualquier base de
datos que ya haya sido creada con `db push` **antes** de que existiera
esta migracion (por ejemplo, un entorno de desarrollo local viejo, o un
ambiente compartido que el equipo levanto antes de PR#4) va a **fallar**
si simplemente se le corre `prisma migrate deploy`, porque Postgres va a
intentar crear tablas que ya existen.

## Como saber si tu base necesita baseline

Si tu base de datos existe desde antes del 18 de septiembre de 2026 (o
no tienes una tabla `_prisma_migrations`), necesitas baseline. Verifica:

```bash
docker exec -i kairos-postgres psql -U kairos -d kairos_dev -c "\dt _prisma_migrations"
```

- Si el comando dice que la tabla **no existe** pero las tablas de
  dominio (`companies`, `branches`, etc.) **si** existen: tu base
  necesita baseline (sigue los pasos de abajo).
- Si la tabla `_prisma_migrations` **si existe**: tu base ya esta
  siendo trackeada por Prisma Migrate, no necesitas baseline - solo
  corre `prisma migrate deploy` normalmente.
- Si no tienes ninguna tabla de dominio todavia (base nueva/vacia): no
  necesitas baseline tampoco, corre `prisma migrate deploy` directo y
  Prisma va a aplicar todas las migraciones desde cero.

## Procedimiento de baseline

1. **Respalda la base** antes de tocar nada (aunque el comando de
   baseline no modifica datos, es buena practica):

   ```bash
   docker exec -i kairos-postgres pg_dump -U kairos kairos_dev > backup-pre-baseline.sql
   ```

2. Marca la migracion inicial como ya aplicada, **sin ejecutarla**
   (Prisma solo registra en `_prisma_migrations` que ya corrio):

   ```bash
   cd apps/api
   npx prisma migrate resolve --applied 20260918000000_init
   ```

3. Repite el paso 2 para cada migracion posterior que tu base YA tenga
   aplicada de facto (por ejemplo si tu base ya tiene la columna
   `role` de `user_company_assignments`, marca tambien
   `20260921180000_add_worker_role` como aplicada). Si no estas
   seguro de cuales, compara el schema real de tu base contra cada
   `migration.sql` en `apps/api/prisma/migrations/`.

4. A partir de ahi, `prisma migrate deploy` funciona normalmente para
   cualquier migracion nueva (incluida
   `20260922000000_fix_company_organization_integrity`):

   ```bash
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```

## Entornos nuevos (sin baseline)

Un Postgres nuevo (como el que levanta `docker-compose.yml` de la raiz
del repo) no necesita ningun paso de baseline - `prisma migrate deploy`
aplica todas las migraciones en orden desde `20260918000000_init` en
adelante.

## Evidencia de CI

`.github/workflows/ci.yml` corre `npx prisma generate` en cada push/PR
contra `apps/api/prisma/schema.prisma`, pero **todavia no** levanta un
Postgres de servicio para correr `prisma migrate deploy` +
`test:integration` de punta a punta contra una base limpia y una base
baselined - ver "Verificacion requerida" en la revision de PR#4. Ese
job de CI (Postgres de servicio + migrate deploy + test:integration) es
un pendiente explicito, no cubierto por este cambio.
