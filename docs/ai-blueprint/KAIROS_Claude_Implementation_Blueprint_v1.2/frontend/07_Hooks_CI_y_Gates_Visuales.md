# Hooks, CI y gates visuales — Frontend

## Hooks obligatorios

### Inicio de tarea

- Validar `source-manifest.yaml` y `prototype-manifest.yaml`.
- Resolver UX-ID y PROTO-ID exactos.
- Verificar aprobación, archivo, versión, hash y disponibilidad.

### Antes de editar

- Exigir task brief con `source_refs`, `visual_refs`, `allowed_paths` y `tests_required`.
- Bloquear UI cuando no exista baseline aprobado o haya conflicto material.

### Después de editar

- Detectar páginas/componentes modificados sin evidencia visual regenerada.
- Detectar cambios de layout, CTA o Design System sin trazabilidad.
- No ejecutar actualización automática de baselines.

### Antes de commit/fin

- Validar manifiestos y cobertura.
- Ejecutar build, lint, typecheck y tests.
- Ejecutar captura, diff, revisión semántica, responsive y WCAG.
- Verificar evidencia y desviaciones aprobadas.

## CI `frontend-visual-fidelity`

1. `validate-prototype-manifest`.
2. `check-visual-coverage` sobre archivos React cambiados.
3. Build determinista con fuentes bloqueadas.
4. Levantar app con fixtures/MSW sin PII.
5. Capturar viewports registrados.
6. Ejecutar comparación de píxeles.
7. Ejecutar assertions semánticos de elementos críticos.
8. Adjuntar baseline/actual/diff/reporte.
9. Emitir veredicto y bloquear ante STOP/FAIL.

## Gate `G4-FE Visual Fidelity`

```yaml
visual_acceptance:
  automatic_difference_threshold_percent: 2.0
  critical_structure_differences_allowed: 0
  missing_primary_actions_allowed: 0
  unauthorized_components_allowed: 0
  undocumented_business_behavior_allowed: 0
  critical_accessibility_findings_allowed: 0
  approved_deviations_required: true
```

El porcentaje es señal, no veredicto: `≤2%` no aprueba si falta un elemento crítico; `>2%` abre revisión y puede aceptarse únicamente con explicación y aprobación.

## Determinismo de captura

- Viewport, DPR, tema, navegador y versión fijados.
- Fuente local/bloqueada, animations/transitions deshabilitadas para captura.
- Locale `es-PE`, timezone `America/Lima` y reloj fijo.
- Fixtures estables, identificadores enmascarados y red externa deshabilitada.
- Espera explícita por fuentes, datos y layout estable; nunca sleeps arbitrarios como criterio.

## Protección del baseline

- Los JPG/PNG aprobados son de solo lectura para jobs de implementación y validación.
- Solo el workflow de ingesta/versionamiento puede crear una nueva versión.
- Todo reemplazo conserva el baseline anterior como `SUPERSEDED`.
- El aprobador del baseline no puede ser el mismo agente que implementa o altera la pantalla.
