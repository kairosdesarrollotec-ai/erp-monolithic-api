---
name: backend-migration
description: "Crea y valida una migracion Prisma/SQL revisable, reproducible y reversible para un cambio de persistencia aprobado."
---

## Proposito
Evitar migraciones no revisables, no reversibles o que arriesguen datos existentes.

## Cuando usarla
Cuando un slice backend requiere un cambio de esquema (tabla, columna, constraint, indice, RLS).

## Parametros de entrada
Modulo, descripcion del cambio de esquema, referencia TDD de datos.

## Fuentes obligatorias
TDD del modulo (seccion de datos/persistencia), `docs/decision-log.md` (si el cambio requiere ADR).

## Precondiciones
El cambio de esquema esta documentado en el TDD; no es una migracion especulativa.

## Secuencia de ejecucion
1. Escribir la migracion Prisma y, cuando Prisma no lo modele, SQL explicito (`EXCLUDE`, partial unique indexes, checks, triggers/RLS).
2. Nunca editar una migracion ya aplicada; crear un forward-fix si algo quedo mal.
3. Probar desde base vacia y, si existe, desde snapshot representativo anonimizado.
4. Documentar plan de rollback/recovery.
5. Nunca ejecutar `db push` contra un ambiente compartido o productivo.

## Condiciones STOP
Cambio de esquema sin respaldo en TDD/ADR; migracion no reversible sin justificacion explicita; riesgo de perdida de datos existentes.

## Artefactos de salida
Archivo(s) de migracion + nota de rollback.

## Validaciones
`prisma-migration-reviewer` revisa antes de considerarse terminada.

## Criterios de aceptacion
Migracion aplicable en limpio, reversible o con forward-fix documentado, sin romper datos existentes.

## Ejemplo minimo de invocacion
`backend-migration(module="rentals", change="agregar constraint de no solapamiento por vehiculo")`
