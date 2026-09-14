---
name: conflict-detection
description: "Escanea un conjunto de fuentes (documentales o visuales) en busca de contradicciones antes o durante una implementacion, sin resolverlas."
---

## Proposito
Detectar contradicciones tempranamente para detener solo el alcance afectado, no todo el trabajo.

## Cuando usarla
Durante `kairos-source-preflight`, o cuando un implementador sospecha que dos fuentes no coinciden.

## Parametros de entrada
Lista de IDs/fuentes a comparar (BDD/SDD/TDD/UX/OpenAPI/prototipo).

## Fuentes obligatorias
Las fuentes senaladas, en su version vigente segun `docs/source-manifest.yaml` / `docs/prototype-manifest.yaml`.

## Precondiciones
Las fuentes existen en el manifiesto correspondiente.

## Secuencia de ejecucion
1. Leer el contenido vigente de cada fuente senalada.
2. Comparar reglas, datos, permisos, contratos y flujo declarados por cada una.
3. Clasificar cualquier discrepancia como: redaccion sin impacto, o contradiccion material.
4. Si es material: delegar el registro formal a `conflict-reviewer` (no lo crea esta skill; solo lo detecta y lo describe).

## Condiciones STOP
Contradiccion material detectada — se detiene solo el alcance afectado por esa contradiccion.

## Artefactos de salida
Reporte de deteccion (insumo para `docs/conflicts/CONFLICT-*.md`, que crea `conflict-reviewer`).

## Validaciones
No confunde una diferencia de redaccion con una contradiccion de regla.

## Criterios de aceptacion
Toda contradiccion material queda descrita con fuentes, version y alcance afectado antes de continuar.

## Ejemplo minimo de invocacion
`conflict-detection(sources=["BR-ALQ-006","UX-ALQ-10"])`
