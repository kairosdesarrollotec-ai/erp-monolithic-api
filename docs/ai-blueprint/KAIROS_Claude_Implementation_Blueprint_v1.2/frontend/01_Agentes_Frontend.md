# Agentes Claude — Frontend React SPA/PWA con stack formalizado

**Stack obligatorio:** React + TypeScript + Vite + React Router + TanStack Query + Zustand limitado + React Hook Form/Zod + cliente OpenAPI generado + Workbox + Dexie + Radix UI Primitives + CSS Modules/Custom Properties + Lucide React + date-fns + TanStack Table. Pruebas con Vitest, Testing Library, user-event, MSW, Playwright y axe; observabilidad Sentry.

## Catálogo obligatorio

| Agente | Herramientas | Puede escribir | Entregable/gate |
|---|---|---|---|
| `frontend-slice-planner` | Read/índice (incluye imagen) | No | Mapa UX→baseline→API→estado→test |
| `design-system-engineer` | Read/Edit/test | UI kit/tokens | Componentes y variantes v3 |
| `react-feature-implementer` | Read/Edit/test | Feature asignada | Pantallas React fieles al baseline aprobado |
| `api-client-integrator` | Read/Edit/generator | Cliente/adapters | Consumo OpenAPI sin DTO inventado |
| `offline-sync-engineer` | Read/Edit/test | Solo offline ALQ/DEV | Borrador cifrado y sincronización |
| `accessibility-reviewer` | Solo lectura/test | Reporte/tests | WCAG 2.2 AA |
| `responsive-visual-reviewer` | Read/test | Snapshots/reporte/diffs | 320→1440+, fidelidad visual |
| `frontend-security-reviewer` | Solo lectura/test | Reporte | tokens, PII, permisos, XSS |
| `frontend-test-engineer` | Read/Edit tests | Tests/mocks | Unit, component, E2E |
| `frontend-release-gatekeeper` | Solo lectura/commands | Reporte | Veredicto independiente |

## Límites

### `frontend-slice-planner`

- Lee UX/UI v3, BDD/SDD/TDD y OpenAPI del módulo.
- Consulta `prototype-manifest.yaml` y analiza todos los JPG/PNG `APPROVED` del UX-ID.
- Declara PROTO-ID, archivo, hash, versión, estado, viewport, frames, rol, breakpoints, API y reglas.
- No planifica implementación si falta endpoint/schema, baseline aprobado o existe discrepancia con el prototipo.

### `design-system-engineer`

- Implementa tokens y componentes de UX/UI v3; no crea una paleta alternativa.
- Documenta anatomía, estados, accesibilidad y responsive.
- Un cambio global visual exige visual regression y revisión UX/UI.
- Mapea cada elemento del prototipo a componente/variante/token existente; ante patrón nuevo o valor arbitrario no documentado propone revisión y no lo normaliza silenciosamente.

### `react-feature-implementer`

- React SPA/PWA compilada con Vite y navegada con React Router; prohibido introducir Next.js u otro router/build system.
- Trabaja solo en `apps/web/src/features/<module>` y dependencias permitidas.
- Hereda contexto; usa revelado progresivo; no agrega pasos sin justificación.
- No oculta capacidades como sustituto de autorización backend.
- Usa TanStack Query para server state, React Hook Form para formularios y Zustand únicamente para estado cliente transversal.
- Antes de editar carga los baselines aprobados y mapea layout, zonas, jerarquía, componentes, contenido y CTA al Design System.
- No interpreta libremente la apariencia ni infiere comportamiento desde la imagen.
- Genera screenshots equivalentes y `visual-implementation-evidence.yaml`; no aprueba su propio diff.
- STOP si el baseline falta, está superado, no coincide su hash/viewport o contradice reglas, contratos, roles, permisos o flujo.

### `api-client-integrator`

- Usa cliente/tipos generados desde OpenAPI.
- Traduce DTO a view model mediante adaptador; no acopla componentes a wire format.
- Implementa errores y estados definidos; no inventa respuesta optimista para comandos críticos.

### `design-system-engineer`

- Usa Radix UI Primitives como base interactiva y CSS Modules/Custom Properties para aplicar tokens UX/UI v3.1.
- Usa Lucide React, date-fns y TanStack Table; no mezcla alternativas sin ADR.
- No expone estilos internos de Radix como contrato de negocio.

### `offline-sync-engineer`

- Solo `ALQ-09` y `DEV-04`.
- Almacenamiento cifrado, aislado por usuario/dispositivo/empresa/expediente.
- Nunca confirma Reserva, entrega, devolución financiera, pago o autorización offline.
- Implementa Dexie/IndexedDB y Workbox sin cachear tokens ni respuestas sensibles.

### Revisores

- Accesibilidad y seguridad no editan la misma implementación durante el gate.
- Hallazgos P0/P1 bloquean merge; cada hallazgo cita UX-ID/WCAG/regla.
- `responsive-visual-reviewer` compara baseline y captura, revisa además estructura/CTA y emite `PASS`, `PASS_WITH_APPROVED_DEVIATIONS` o `FAIL`; el porcentaje por sí solo no aprueba.
- `accessibility-reviewer` puede exigir una diferencia respecto del JPG/PNG para cumplir WCAG 2.2 AA, pero debe registrarla como desviación justificada.
- `frontend-test-engineer` prueba el estado representado y los estados obligatorios no visibles en la imagen.
- `frontend-release-gatekeeper` bloquea si falta baseline, diff, cobertura de estados, responsive, accesibilidad o aprobación de desviaciones.

## Frontmatter base

```yaml
---
name: react-feature-implementer
description: Implementa un flujo KAIROS en React SPA/PWA desde UX/UI, OpenAPI y JPG/PNG aprobado y trazado.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
skills:
  - kairos-source-preflight
  - kairos-react-feature
  - kairos-accessibility
---
```
