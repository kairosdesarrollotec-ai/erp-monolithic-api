---
name: frontend-screen
description: "Implementa una pantalla KAIROS trazada a UX-ID, fuentes documentales y prototipo APPROVED en prototype-manifest.yaml (incluye exports Stitch)."
---

## Proposito
Ejecutar el flujo normativo completo de una pantalla: desde el UX-ID hasta la evidencia de fidelidad visual y trazabilidad, sin inventar reglas desde la imagen.

## Cuando usarla
Al implementar o modificar una pantalla concreta identificada por `UX-ID`.

## Parametros de entrada
`task_id` (obligatorio), `ux_id` (obligatorio), `visual_refs` (opcional; si se omite, se resuelve desde `prototype-manifest.yaml`).

## Fuentes obligatorias
`docs/prototype-manifest.yaml`, especificacion UX/UI v3.1, BDD/SDD/TDD/OpenAPI del modulo, Design System (`DESIGN.md`).

## Precondiciones
`kairos-source-preflight` en PASS. Debe existir al menos un `PROTO-ID` con `status: APPROVED` para el `UX-ID`.

## Secuencia de ejecucion
1. Recibir `ux_id` obligatorio.
2. Localizar la especificacion UX/UI correspondiente (seccion 5 del documento UX/UI v3.1).
3. Consultar `prototype-manifest.yaml`.
4. Verificar que exista al menos un `PROTO-ID` `APPROVED` vigente.
5. STOP `MISSING_VISUAL_BASELINE` si no existe.
6. Analizar visualmente el prototipo aprobado (`screen.png`; usar `code.html` de Stitch como referencia de estructura cuando exista).
7. Identificar layout, zonas, jerarquia, componentes y contenido visible.
8. Resolver referencias BDD, SDD, TDD y OpenAPI.
9. Detectar contradicciones entre imagen y documentacion (usar `conflict-detection`); detenerse si afecta reglas, datos, permisos o flujo.
10. Identificar componentes reutilizables del Design System (`design-system` skill).
11. Implementar la pantalla en React segun el stack inmutable.
12. Completar estados no visibles en la imagen desde UX/UI y Design System: loading, vacio, error, validacion, guardado, confirmacion, permisos, sesion vencida, offline cuando aplique.
13. Construir variantes responsive faltantes sin contradecir la referencia.
14. Ejecutar pruebas funcionales, accesibilidad (`accessibility`) y navegacion.
15. Generar captura de la implementacion (`responsive-visual`).
16. Compararla visualmente con el prototipo aprobado.
17. Actualizar trazabilidad (`traceability-update`) y evidencias.

## Condiciones STOP
`MISSING_VISUAL_BASELINE`, `SOURCE_CONFLICT` material, `MISSING_API_CONTRACT`, componente fuera del Design System sin justificacion.

## Artefactos de salida
Codigo de la pantalla, captura + diff en `artifacts/evidence/`, entrada de trazabilidad.

## Validaciones
Diferencia de pixeles <=2% orientativa; cero diferencias criticas de estructura/jerarquia; cero reglas inferidas solo de la imagen; cero componentes fuera del Design System sin justificacion; desviaciones intencionales requieren aprobacion humana registrada.

## Criterios de aceptacion
Pantalla implementada, trazada, probada y con evidencia visual comparada contra el baseline `APPROVED`.

## Ejemplo minimo de invocacion
`frontend-screen(task_id="KAI-ALQ-014", ux_id="ALQ-09")`
