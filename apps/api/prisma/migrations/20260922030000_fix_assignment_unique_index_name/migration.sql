-- Correccion detectada en la revalidacion de PR#7 (23 sep 2026): drift de
-- NOMBRE de indice entre schema.prisma y 20260918000000_init (escrita a
-- mano en PR#4).
--
-- Para @@unique([firebaseUid, companyId, branchId]) Prisma calcula el nombre
-- "user_company_assignments_firebase_uid_company_id_branch_id_key" (62
-- caracteres, no necesita truncarse), pero la migracion inicial lo creo
-- truncado como "..._branch_i_key". Mismas columnas, sin efecto funcional,
-- pero `prisma migrate dev` / `prisma migrate diff` lo reportan como drift
-- (es exactamente lo que genero localmente la migracion no versionada
-- `20260918210725_init` en el entorno de Russbel).
--
-- IF EXISTS: en una base donde ese renombre ya se aplico, esta migracion no
-- hace nada.
ALTER INDEX IF EXISTS "user_company_assignments_firebase_uid_company_id_branch_i_key"
    RENAME TO "user_company_assignments_firebase_uid_company_id_branch_id_key";
