-- AlterEnum: add PLATFORM_ADMIN to WorkerRole
-- ADD VALUE is transactional-safe in PostgreSQL 12+ when NOT using IF NOT EXISTS inside a transaction.
-- Prisma migrate wraps DDL in a transaction; ADD VALUE is allowed outside BEGIN/COMMIT in PG14+,
-- but Supabase/PG15 supports it. Using a DO block to make it idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PLATFORM_ADMIN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'WorkerRole')
  ) THEN
    ALTER TYPE "WorkerRole" ADD VALUE 'PLATFORM_ADMIN';
  END IF;
END
$$;
