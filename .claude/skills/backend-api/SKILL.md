---
name: backend-api
description: "Crea o modifica el contrato OpenAPI versionado y coordina DTO, validacion, cliente generado, mocks, pruebas y trazabilidad del cambio."
---

## Proposito
Mantener el contrato como fuente unica entre frontend y backend, sin clientes duplicados ni DTO inventado.

## Cuando usarla
Cuando un slice backend expone o modifica un endpoint.

## Parametros de entrada
Modulo, operacion(es) afectadas, referencia TDD/BR.

## Fuentes obligatorias
TDD del modulo, especificacion OpenAPI vigente (o su ausencia, que se reporta como `MISSING_API_CONTRACT`).

## Precondiciones
La operacion esta documentada en TDD; no se inventan endpoints.

## Secuencia de ejecucion
1. Editar la especificacion OpenAPI 3.1 (contract-first): request/response, errores, ejemplos, scopes, idempotencia y paginacion segun corresponda.
2. Marcar breaking changes con nueva version.
3. Regenerar tipos/cliente para frontend y backend (sin DTO manual duplicado).
4. Actualizar mocks (MSW) y contract tests.
5. Actualizar trazabilidad del contrato.

## Condiciones STOP
`MISSING_API_CONTRACT` (no hay ubicacion real del contrato en el repo todavia — reportar y no inventar una), breaking change sin version, `PATCH status` generico.

## Artefactos de salida
Especificacion OpenAPI actualizada, cliente/tipos generados, mocks y contract tests.

## Validaciones
`api-contract-reviewer` revisa antes de considerarse terminado.

## Criterios de aceptacion
Contrato, DTO, cliente generado y mocks coordinados; cero endpoints o campos inventados.

## Ejemplo minimo de invocacion
`backend-api(module="rentals", operation="POST /rentals/{id}/extend")`
