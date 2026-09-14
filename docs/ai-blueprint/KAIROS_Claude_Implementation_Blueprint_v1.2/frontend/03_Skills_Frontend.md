# Skills Claude — Frontend

| Skill | Activación | Resultado |
|---|---|---|
| `kairos-source-preflight` | Todo cambio | Fuentes, baselines aprobados, API y allowed paths |
| `kairos-prototype-intake` | Nuevo/reemplazo de JPG/PNG | PROTO-ID, metadatos, hash y estado de aprobación |
| `kairos-react-feature` | Crear feature/pantalla | Slice React trazado al baseline |
| `kairos-design-system` | Crear/modificar componente desde UX/UI/prototipo | Mapa visual→tokens/variantes, docs y tests |
| `kairos-openapi-client` | Integrar API | Cliente generado + adapter/view model |
| `kairos-react-router` | Ruta/layout/guard | Routing tipado, lazy loading, breadcrumbs y retorno |
| `kairos-tanstack-query` | Query/mutation | Keys, cache, invalidación y errores sin duplicación |
| `kairos-zustand-client-state` | Estado transversal cliente | Store mínimo, sin API/formularios/PII |
| `kairos-form-workflow` | Formulario/stepper | Validación, autoguardado y errores |
| `kairos-data-table` | Bandeja/listado | Filtros, acciones, estados y responsive |
| `kairos-offline-checklist` | ALQ-09/DEV-04 | Máquina de sync cifrada y tests |
| `kairos-vite-pwa` | Shell/cache/service worker | Configuración Workbox segura para Firebase Hosting |
| `kairos-accessibility` | Pantalla/componente | Tests axe/teclado/lector y checklist |
| `kairos-responsive-visual` | Final de slice | Baseline, screenshots, diffs y veredicto |
| `kairos-frontend-testing` | Final de slice | Unit/component/E2E y evidencia |

## Contrato común

Cada `SKILL.md` contiene: trigger, non-goals, fuentes, inputs, procedimiento, paths, scripts, STOP conditions, outputs y DoD. Debe cargar referencias específicas solo al invocarse.

## `kairos-react-feature`

1. Resolver UX-ID y consultar `prototype-manifest.yaml`.
2. Verificar PROTO-ID, archivo, aprobación, versión, hash, estado y viewport.
3. Analizar todos los JPG/PNG aprobados: layout, zonas, jerarquía, componentes, contenido y CTA.
4. Resolver BR, UC, TDD, OpenAPI, roles y permisos.
5. Detectar conflictos y aplicar STOP cuando corresponda.
6. Definir estados, rutas y presupuesto de interacciones.
7. Mapear componentes/tokens existentes antes de crear nuevos.
8. Generar view model desde cliente OpenAPI.
9. Implementar el estado baseline y los alternativos requeridos.
10. Completar responsive, accesibilidad, errores y siguiente acción.
11. Generar screenshots equivalentes y ejecutar visual regression.
12. Ejecutar gates y actualizar trazabilidad/evidencia.

STOP: endpoint faltante, campo no documentado, flujo contradictorio, dependencia nueva, pantalla no trazada, baseline no aprobado, hash/versión/viewport no vigente o contradicción material imagen-documentación.

La skill debe rechazar implementaciones que usen fetch manual disperso, DTO duplicado, estado remoto en Zustand, formularios globales o rutas fuera de React Router.

## `kairos-prototype-intake`

1. Recibe JPG/PNG, UX-ID, estado, viewport y versión.
2. Valida formato, legibilidad, resolución y ausencia de secretos/PII real.
3. Genera PROTO-ID y hash SHA-256.
4. Registra descripción estructurada y relaciones sin convertir OCR en requisito.
5. Guarda inicialmente como `DRAFT` o `REVIEWED`; solo el rol UX/UI autorizado cambia a `APPROVED`.
6. Si reemplaza un baseline, marca el anterior `SUPERSEDED` sin borrarlo.

## `kairos-design-system` con baseline

Mapea cada elemento visible a un componente, variante y token aprobado. Un valor mostrado en píxeles no autoriza hex, radio, sombra o tamaño arbitrario. Si no existe una equivalencia válida, detiene la implementación y solicita decisión UX/UI antes de crear o alterar un patrón global.

## `kairos-source-preflight` para UI

Valida `source_refs`, `visual_refs`, `allowed_paths`, `prototype-manifest`, hash, versión, aprobación y disponibilidad local de cada imagen. Devuelve STOP codes normativos y nunca elige por semejanza un prototipo no trazado.

## `kairos-responsive-visual`

- Captura con Playwright usando viewport, DPR, tema, fuente, locale, timezone y datos fixture deterministas.
- Compara imagen aprobada con implementación y produce baseline/actual/diff/reporte.
- Evalúa porcentaje y semántica: estructura, jerarquía, CTA, componentes y contenido esperado.
- No actualiza baseline durante validación. Cualquier reemplazo usa `kairos-prototype-intake` y aprobación separada.
- Emite únicamente los veredictos definidos en Reglas Frontend.

## `kairos-offline-checklist`

- Verifica que el frame sea ALQ-09 o DEV-04.
- Modela `LOCAL_DRAFT → SYNCING → SYNCED` y `SYNC_CONFLICT/ERROR`.
- Conserva evidencia y resuelve conflicto sin last-write-wins silencioso.
- Confirmación final exige servidor.
- Prueba cambio de usuario, expiración, storage lleno, cierre, reconexión, duplicado y conflicto.

## Scripts recomendados

- `scripts/generate-api-client.ts`
- `scripts/check-ui-tokens.ts`
- `scripts/check-ux-traceability.ts`
- `scripts/check-click-budget.ts`
- `scripts/run-a11y.ts`
- `scripts/run-visual-regression.ts`
- `scripts/validate-prototype-manifest.ts`
- `scripts/capture-screen.ts`
- `scripts/check-visual-coverage.ts`
- `scripts/check-sensitive-client-data.ts`

Las skills invocan scripts existentes; no copian manualmente lógica de validación.
