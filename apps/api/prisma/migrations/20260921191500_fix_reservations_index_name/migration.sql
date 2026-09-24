-- Correccion cosmetica: el nombre de indice escrito a mano en
-- 20260921190000_add_reservations tenia un typo (doble guion bajo,
-- faltaba "id") respecto al nombre que Prisma genera automaticamente
-- para este mismo indice a partir de schema.prisma. Sin efecto
-- funcional - mismo indice, mismas columnas - solo alinea el nombre
-- para que `prisma migrate dev` no detecte drift despues de aplicar la
-- migracion anterior.
ALTER INDEX "reservations_organization_id_operating_company_id_branch__idx" RENAME TO "reservations_organization_id_operating_company_id_branch_id_idx";
