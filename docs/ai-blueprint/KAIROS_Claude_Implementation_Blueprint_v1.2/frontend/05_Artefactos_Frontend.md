# Artefactos requeridos — Frontend

## Fundación

- `apps/web/CLAUDE.md` con React SPA/PWA y límites locales.
- App shell, routing, sesión, empresa/sede, permisos, notificaciones y sync center.
- `vite.config.ts`, `firebase.json`, manifiesto PWA y configuración Workbox.
- Configuración React Router con rutas, layouts, guards y breadcrumbs.
- Provider, query keys y defaults de TanStack Query.
- Stores Zustand mínimos y documentados.
- Formularios React Hook Form/Zod.
- Tokens consumibles por CSS/TypeScript y design tokens exportables.
- Catálogo Radix/design system con anatomía, estados y ejemplos.
- Cliente API generado y adapters a view models.
- Base Dexie cifrada y máquina de sincronización solo para ALQ-09/DEV-04.
- `docs/prototype-manifest.yaml` como catálogo normativo de baselines visuales.
- `artifacts/visual/<UX-ID>/` para screenshots, diffs, reportes y evidencia.

## Features

- `apps/web/src/features/inquiries/`
- `apps/web/src/features/reservations/`
- `apps/web/src/features/rentals/`
- `apps/web/src/features/returns/`
- `apps/web/src/features/recruitment/`
- `apps/web/src/features/hr-administration/`
- Soporte: customers, fleet, payments, incidents, reporting, admin.

Cada feature incluye rutas, pages, components, hooks/use-cases, adapters, schemas de formulario, tests y archivo de trazabilidad.

## Pantallas y variantes

- 75 IDs lógicos de UX/UI v3 o consolidación documentada.
- Desktop para oficina.
- Móvil para autenticación, Gerencia, notificaciones, ALQ-09, DEV-04 y ADP-06/07.
- Loading, empty, ready, validating, saving, success, recoverable/blocking error, forbidden, session expired y stale.
- Offline/sync solo donde aplica.
- Cada UX-ID visual tiene al menos un JPG/PNG `APPROVED`; cada imagen declara estado y viewport, por lo que no se presume cobertura de variantes no registradas.

## Pruebas

- Unit de formatters, adapters, reducers/state machines y validación.
- Component tests de formularios, tablas, modales, stepper, evidence y estados.
- Contract mocks derivados de OpenAPI.
- MSW handlers generados o verificados contra OpenAPI.
- Playwright E2E por rol y flujo.
- Axe automatizado más teclado y lector de pantalla manual.
- Visual regression en 320, 768, 1024 y 1440 px.
- Captura determinista con misma fuente, locale, timezone, DPR, tema, viewport y fixtures del baseline.
- Revisión semántica de estructura, jerarquía y CTA además del porcentaje de píxeles.
- Click-budget y métricas de flujo.
- PWA/offline/reconexión/expiración.
- Gate de dependencias y lockfile contra allowlist del stack frontend.

## Observabilidad y analítica

- Error boundary y Sentry sin PII.
- Web vitals/rendimiento.
- Eventos de inicio/fin/error de tarea, no contenido sensible.
- Correlation ID solo en error/soporte.
- Dashboards de fallo de API, sync, upload y abandono.

## Matriz UX→Frontend

Por cada ID crear:

```yaml
ux_id: RES-04
route: /reservations/:id/requirements
roles: [front-office]
source_refs: [BR-RES-001, BR-RES-006, BR-RES-009, UC-RES-002]
visual_refs: [PROTO-RES-04-READY-DESKTOP]
api_operations: [getReservation, registerPayment, confirmReservation]
components: [Stepper, DocumentUploader, PaymentPanel, ConfirmDialog]
states: [loading, draft, ready, saving, conflict, forbidden]
breakpoints: [desktop, tablet]
tests: [RES-04-component, RES-confirm-e2e]
visual_tests: [RES-04-ready-desktop-visual]
visual_evidence: artifacts/visual/RES-04/visual-implementation-evidence.yaml
```

## Manifiesto de prototipos

Cada entrada incluye: PROTO-ID único, UX-ID, módulo, ruta de imagen, formato, versión, estado visual, viewport, DPR, tema, locale, timezone, estado de aprobación, aprobador, fecha, hash SHA-256, fuente UX/UI, descripción estructurada y baseline reemplazado. Solo `APPROVED` puede alimentar `/frontend-screen` y el gate.

## Evidencia visual

Por baseline se conservan `baseline`, `actual`, `diff`, reporte de comparación, revisión semántica, findings de accesibilidad y desviaciones aprobadas. Los artefactos usan fixtures sin PII real y no se incorporan a embeddings.

## Handoff por slice

- Screens/componentes implementados.
- Matriz de estados y breakpoints.
- Evidencia de accesibilidad y visual regression.
- Trazabilidad UX/BDD/API/prototipo/test/evidencia.
- Métricas de interacción.
- Riesgos/deviations y decisión registrada.
