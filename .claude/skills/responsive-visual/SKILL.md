---
name: responsive-visual
description: "Captura la implementacion en los viewports relevantes, compara contra el screen.png del PROTO-ID vigente y valida fidelidad visual y responsive."
---

## Proposito
Confirmar objetivamente que la implementacion coincide con el baseline aprobado, sin depender de una revision subjetiva del propio implementador.

## Cuando usarla
Como ultimo paso de `frontend-screen`/`frontend-flow`, o al modificar una pantalla ya implementada.

## Parametros de entrada
`ux_id`, `proto_id` de referencia, rutas de la implementacion a capturar.

## Fuentes obligatorias
`docs/prototype-manifest.yaml` (para obtener `screen.png` y viewport del `PROTO-ID`).

## Precondiciones
La pantalla esta implementada y navegable en el entorno de pruebas local.

## Secuencia de ejecucion
1. Resolver el `PROTO-ID` vigente y su viewport/estado declarado.
2. Capturar la implementacion en el mismo viewport/estado.
3. Calcular diferencia de pixeles (orientativa, <=2%) y revisar semanticamente estructura, jerarquia, orden, componentes, tokens, CTA principal y estados interactivos.
4. Verificar variantes responsive (320->1440+) sin contradecir la referencia.
5. Guardar captura + diff en `artifacts/evidence/<ux_id>/`.
6. El implementador no aprueba su propio resultado ni actualiza el baseline; una diferencia intencional requiere aprobacion humana registrada.

## Condiciones STOP
Diferencia critica de estructura, jerarquia o CTA sin aprobacion humana registrada.

## Artefactos de salida
`artifacts/evidence/<ux_id>/<task_id>-visual-implementation-evidence.yaml` + capturas/diffs.

## Validaciones
Accesibilidad y semantica prevalecen sobre coincidencia ciega de pixeles.

## Criterios de aceptacion
Cero diferencias criticas abiertas; toda desviacion intencional esta registrada y aprobada.

## Ejemplo minimo de invocacion
`responsive-visual(ux_id="ALQ-09", proto_id="PROTO-ALQ-09-...")`
