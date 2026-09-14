---
name: frontend-testing
description: "Genera pruebas Vitest/Testing Library/MSW/Playwright/axe para los estados obligatorios y el flujo critico de una pantalla o feature."
---

## Proposito
Asegurar cobertura proporcional al cambio sin ejecutar la suite completa en cada edicion.

## Cuando usarla
Tras implementar o modificar una pantalla/feature frontend.

## Parametros de entrada
Ruta del feature/pantalla, lista de estados obligatorios a cubrir.

## Fuentes obligatorias
Especificacion UX/UI seccion 4.1 (Estados universales), contrato OpenAPI del feature.

## Precondiciones
El feature esta implementado y compila.

## Secuencia de ejecucion
1. Identificar estados obligatorios (loading, vacio, error, validacion, guardado, confirmacion, permisos, sesion vencida, offline si aplica).
2. Escribir pruebas de componente/unitarias por estado con Testing Library + MSW (sin llamadas HTTP reales).
3. Escribir un E2E Playwright del flujo critico.
4. Ejecutar axe sobre la pantalla.
5. Ejecutar solo las pruebas del alcance modificado.

## Condiciones STOP
Estado obligatorio sin prueba; prueba que depende de red real en vez de MSW.

## Artefactos de salida
Archivos de test bajo el mismo feature; reporte de ejecucion.

## Validaciones
No declarar una prueba como pasada sin haberla ejecutado.

## Criterios de aceptacion
Cobertura de los estados obligatorios y del flujo critico, ejecutada realmente.

## Ejemplo minimo de invocacion
`frontend-testing(feature="apps/web/src/features/alquiler/checklist-entrega")`
