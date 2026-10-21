-- Rollback de 20261019000900_hr_areas_catalog (solo el catalogo; el backfill de textos no se revierte).
DROP TABLE IF EXISTS "hr_areas";
