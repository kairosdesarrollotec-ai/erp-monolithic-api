# Comandos Claude — Frontend y baselines visuales

## Contrato común

Todo comando visual recibe `task-id`, `ux-id` y referencias explícitas o las resuelve exclusivamente desde manifiestos vigentes. Ningún comando elige imágenes por similitud de nombre. Las salidas incluyen `Verdict`, `Sources`, `Visual sources`, `Findings`, `Changes`, `Tests`, `Evidence`, `Risks` y `Open questions`.

## `/frontend-prototype-register`

Registra o versiona un JPG/PNG. Entradas: `ux-id`, `image`, `state`, `viewport`, `version`, `theme`, `locale`, `timezone` y baseline reemplazado opcional. Valida formato, resolución, PII, calcula SHA-256, genera PROTO-ID y actualiza el manifiesto. Nunca autoaprueba: el estado inicial es `DRAFT` o `REVIEWED`; la aprobación UX/UI es independiente.

## `/frontend-screen`

Entradas obligatorias: `task-id`, `ux-id`. `visual-refs` puede proporcionarse o resolverse desde `prototype-manifest.yaml`, pero debe contener al menos un baseline `APPROVED` vigente.

Flujo normativo:

1. Resolver UX-ID y task brief.
2. Localizar UX/UI y baselines aprobados.
3. Verificar archivo, versión, hash, estado, viewport y aprobación.
4. Analizar layout, zonas, jerarquía, componentes, contenido y CTA.
5. Resolver BDD, SDD, TDD, OpenAPI, roles y permisos.
6. Detectar contradicciones y aplicar STOP codes.
7. Mapear Design System.
8. Implementar React con stack aprobado.
9. Completar estados y responsive no visibles desde UX/UI/Design System.
10. Probar funcionalidad, navegación, permisos, accesibilidad y errores.
11. Capturar con entorno determinista y comparar.
12. Actualizar trazabilidad y evidencia.

## `/frontend-visual-validate`

Entrada: `ux-id`, `proto-id`, ruta/estado navegable y fixture. Produce baseline copiado de solo lectura, actual, diff y reporte. El umbral inicial es 2%, pero también valida estructura, jerarquía, CTA, componentes y accesibilidad. Prohibido actualizar el baseline desde este comando.

## `/frontend-flow`

Valida una secuencia de UX-ID por rol: continuidad de contexto, presupuesto de interacciones, rutas, permisos, estados y cobertura visual de cada pantalla. Falla si existe callejón sin salida o pantalla no trazada.

## `/frontend-release-check`

Ejecuta build/lint/typecheck, tests, contratos, seguridad, accesibilidad, PWA y `G4-FE Visual Fidelity`. Requiere cobertura visual 100% del alcance, cero diferencia crítica y aprobación de desviaciones. No modifica producto ni baselines.

## STOP codes

| Código | Causa |
|---|---|
| `STOP_MISSING_BASELINE` | No existe JPG/PNG aprobado para el UX-ID requerido |
| `STOP_STALE_BASELINE` | Archivo, versión, hash o viewport no coincide con el manifiesto |
| `STOP_SOURCE_CONFLICT` | Imagen contradice negocio, contrato, rol, permiso, datos o flujo |
| `STOP_UNAPPROVED_DEVIATION` | Diferencia intencional sin aprobación UX/UI/accesibilidad correspondiente |
| `FAIL_VISUAL_FIDELITY` | Comparación o revisión semántica no cumple |

## Ejemplo

```text
/frontend-screen --task-id KAI-ALQ-009 --ux-id ALQ-09 \
  --visual-refs PROTO-ALQ-09-READY-DESKTOP,PROTO-ALQ-09-READY-MOBILE
```
