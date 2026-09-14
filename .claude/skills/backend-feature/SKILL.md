---
name: backend-feature
description: "Implementa un slice backend (dominio + aplicacion + modulo NestJS) para un modulo asignado, siguiendo BR/UC/TDD y respetando limites de capa."
---

## Proposito
Traducir reglas de negocio documentadas en codigo backend sin inventar campos, estados ni endpoints.

## Cuando usarla
Al implementar o modificar logica de dominio/aplicacion de un modulo backend.

## Parametros de entrada
Modulo (`customers|fleet|inquiries|reservations|rentals|returns|payments|evidence|incidents|recruitment|hr-administration|notifications|audit`), `source_refs` (BR/UC/TDD), `allowed_paths`.

## Fuentes obligatorias
BDD/SDD/TDD del modulo y Transversal, `docs/decision-log.md`.

## Precondiciones
`kairos-source-preflight` en PASS; plan de `backend-slice-planner` disponible.

## Secuencia de ejecucion
1. Modelar agregados/VO/invariantes del dominio sin dependencias de framework.
2. Implementar casos de uso de aplicacion que orquestan el dominio.
3. Implementar adaptadores NestJS (`presentation`) que exponen los casos de uso.
4. Validar tenant, autorizacion, precondiciones e idempotencia en todo comando critico.
5. Coordinar con `backend-api` si el slice requiere contrato nuevo/modificado.
6. Coordinar con `backend-migration` si el slice requiere persistencia nueva/modificada.

## Condiciones STOP
`MISSING_SOURCE`, campo/estado/regla no documentado, acceso a tabla de otro modulo.

## Artefactos de salida
Codigo del modulo backend asignado.

## Validaciones
Dominio sin NestJS/Prisma/HTTP/Firebase; estados cambian solo por comandos explicitos.

## Criterios de aceptacion
El slice implementa exactamente lo documentado, con limites de capa respetados y sin invenciones.

## Ejemplo minimo de invocacion
`backend-feature(module="rentals", source_refs=["BR-ALQ-006","TDD-03-4.2"])`
