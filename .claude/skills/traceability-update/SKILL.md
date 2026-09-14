---
name: traceability-update
description: "Actualiza artifacts/traceability/ tras un cambio, enlazando BDD->SDD->TDD->UX-ID->PROTO-ID->OpenAPI->codigo->pruebas->evidencia para el slice modificado."
---

## Proposito
Dejar navegable la cadena de trazabilidad de cada slice implementado, sin depender de memoria o de que alguien la reconstruya despues.

## Cuando usarla
Al finalizar la implementacion de un slice, antes de pedir revision (`release-gatekeeper`).

## Parametros de entrada
`task_id`, IDs BDD/SDD/TDD/UX/PROTO tocados, rutas de codigo modificadas, IDs de test ejecutados, ruta de evidencia generada.

## Fuentes obligatorias
`docs/source-manifest.yaml`, `docs/prototype-manifest.yaml`, resultado real de pruebas (no declarado, ejecutado).

## Precondiciones
El slice ya paso `kairos-source-preflight` y fue implementado.

## Secuencia de ejecucion
1. Reunir todos los IDs tocados por el slice.
2. Verificar que cada ID exista en su manifiesto correspondiente (si no, STOP y remitir a `index-maintainer`/`prototype-intake`).
3. Escribir/actualizar `artifacts/traceability/<modulo>/<task_id>.md` con la cadena completa y enlaces relativos.
4. No marca el slice como terminado; eso lo decide `release-gatekeeper`.

## Condiciones STOP
Un eslabon de la cadena no existe en ningun manifiesto ni fue registrado como pendiente explicito.

## Artefactos de salida
`artifacts/traceability/<modulo>/<task_id>.md`.

## Validaciones
Cada enlace de la cadena resuelve a un archivo o ID real (no texto suelto).

## Criterios de aceptacion
Un revisor puede navegar de la regla de negocio a la evidencia sin buscar manualmente.

## Ejemplo minimo de invocacion
`traceability-update(task_id="KAI-ALQ-014", chain={bdd:"BR-ALQ-006", ux_id:"ALQ-10", proto_id:"PROTO-ALQ-10-...", tests:["TEST-ALQ-INT-003"]})`
