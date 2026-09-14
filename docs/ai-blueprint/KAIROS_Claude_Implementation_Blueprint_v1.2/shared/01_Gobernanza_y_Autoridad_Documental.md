# Gobernanza, autoridad documental y controles anti-alucinación

## 1. Jerarquía de fuentes

| Prioridad | Fuente | Autoridad |
|---:|---|---|
| 1 | Decisión explícita aprobada y registrada en Decision Log | Resuelve contradicciones; no puede inventarse retroactivamente |
| 2 | BDD de proceso más reciente | Regla, significado, actores y comportamiento de negocio |
| 3 | SDD de proceso más reciente + SDD Transversal | Componentes, límites, tácticas y solución lógica |
| 4 | TDD de proceso más reciente + TDD Transversal | Implementación física, datos, API, concurrencia y pruebas |
| 5 | OpenAPI, JSON Schema, migraciones y ADR aprobados | Contrato ejecutable; deben corresponder al TDD |
| 6A | UX/UI v3.1 | Interacción, navegación, estados, responsive, accesibilidad y comportamiento de interfaz |
| 6B | JPG/PNG aprobado y trazado | Autoridad visual solo para el UX-ID, estado, viewport y versión declarados; no redefine negocio, contratos ni stack |
| 7 | Código y pruebas | Implementación; no convierten un defecto existente en requisito |

Cuando dos documentos del mismo nivel discrepen, prevalece la versión más reciente solo si el historial registra explícitamente el cambio. En otro caso se bloquea el slice afectado.

## 2. Manifiesto obligatorio de fuentes

Crear `docs/source-manifest.yaml` con una entrada por documento:

```yaml
- id: TDD-TRANSVERSAL
  path: docs/tdd/00-transversal.md
  version: "3.3"
  date: "2026-09-04"
  status: complete_pending_formal_review
  sha256: generated-in-ci
  authority: technical
  supersedes: [TDD-TRANSVERSAL-3.2]
```

El CI falla si cambia el hash sin actualizar versión, fecha y changelog. Los agentes leen primero este manifiesto y no buscan documentos por nombres aproximados.

## 3. Preflight obligatorio de cada tarea

Antes de editar, el agente debe producir:

```yaml
task_id: KAI-<modulo>-<numero>
scope: backend|frontend|shared
source_refs: [BR-..., UC-..., TDD-seccion, UX-ID]
visual_refs: [PROTO-UX-ID-STATE-VIEWPORT]
assumptions: []
open_questions: []
allowed_paths: []
forbidden_paths: []
contracts_affected: []
tests_required: []
```

Reglas:

- `source_refs` vacío: **STOP**.
- Para una pantalla, `visual_refs` vacío o sin baseline `APPROVED`: **STOP_MISSING_BASELINE**.
- Hash, versión o viewport del baseline no vigentes: **STOP_STALE_BASELINE**.
- Una suposición material: **STOP** y registrar pregunta.
- Fuente contradictoria: **STOP** y registrar `DOC-CONFLICT-*`.
- Cambio fuera de MVP: **STOP** y solicitar aprobación de alcance.
- Ningún agente puede marcar por sí mismo una pregunta como resuelta.

### 3.1 Autoridad y conflictos visuales

- La imagen aprobada define composición, jerarquía, orden visual, contenido visible y apariencia del estado/viewport registrado.
- UX/UI y Design System completan estados no visibles, responsive, interacción y accesibilidad.
- BDD/SDD/TDD/OpenAPI prevalecen sobre cualquier comportamiento, dato, rol, permiso o contrato inferido desde una imagen.
- Contradicción que afecte reglas, datos, roles, permisos, CTA crítico o flujo: `STOP_SOURCE_CONFLICT` y registro `UX-CONFLICT-*`.
- Contraste, foco, semántica o tamaño táctil defectuoso en el prototipo se corrigen por WCAG 2.2 AA y se registran como desviación visual justificada.
- Adjuntar una imagen no equivale a aprobarla. Estados válidos: `DRAFT`, `REVIEWED`, `APPROVED`, `SUPERSEDED`, `REJECTED`.

## 4. Política de no invención

Claude no puede inventar:

- endpoints, campos, estados, roles, permisos, reglas, tarifas o SLA;
- tablas, columnas o relaciones no justificadas por TDD/ADR;
- contenido legal, textos de consentimiento o retención;
- comportamiento offline adicional a `ALQ-09` y `DEV-04`;
- `VehicleHold`, expiración automática de reserva o confirmación offline;
- integración productiva con Motrix, firma digital definitiva o WhatsApp bidireccional;
- cuarta persona en la cascada ADP ni reutilización automática de esa cascada para notaría;
- Next.js: está prohibido; la implementación vigente es React SPA/PWA con Vite y React Router.
- Alternativas al stack frontend formalizado: requieren ADR; ningún agente puede introducir Redux Toolkit, Axios, Tailwind, otro router, otro form manager o un segundo data cache por preferencia propia.

Una necesidad técnica incidental puede proponerse en ADR con estado `PROPOSED`; no se implementa hasta aprobación cuando modifica contrato, persistencia, seguridad o alcance.

## 5. Formato de evidencia de implementación

Cada PR incluye `implementation-evidence.yaml`:

```yaml
requirement_refs: [BR-RES-009]
design_refs: [UC-RES-002, TDD-RES-9, UX-RES-04]
visual_refs: [PROTO-RES-04-READY-DESKTOP]
changed_contracts: [openapi/reservations.yaml]
changed_migrations: [db/migrations/....sql]
tests: [TEST-RES-INT-001, CONC-001]
security_checks: [tenant-negative, authorization, idempotency]
deviations: []
visual_evidence: artifacts/visual/RES-04/visual-implementation-evidence.yaml
```

## 6. Roles de aprobación

- Sponsor/Producto: alcance y regla de negocio.
- Tech Lead/Arquitectura: ADR, límites y contratos.
- Datos: migraciones, constraints, RLS y conciliación.
- Seguridad: IAM, privacidad, ASVS y amenazas.
- UX/UI: flujo, componentes, responsive y accesibilidad.
- QA: escenarios, trazabilidad y gates.

La misma persona puede cubrir varios roles, pero cada decisión debe registrar desde qué rol se aprobó.

## 7. Discrepancias conocidas iniciales

| ID | Conflicto | Resolución de implementación |
|---|---|---|
| DOC-CONFLICT-001 | UX/UI v3.0 decía Next.js; TDD v3.3 decía React SPA/PWA sin Next.js | `RESUELTO` el 10/09/2026 en SDD v3.6, TDD v3.4 y UX/UI v3.1: React + Vite + React Router, sin Next.js |
| DOC-CONFLICT-002 | Referencia visual GPS usó BR-ALQ-006 | GPS corresponde a BR-ALQ-010 |
| DOC-CONFLICT-003 | Referencia visual de daño grave usó BR-DEV-008 | Clasificación: BR-DEV-007; irreversibilidad/riesgo: BR-DEV-008 |

## 8. CLAUDE.md raíz requerido

El `CLAUDE.md` raíz debe ser breve: propósito, jerarquía, prohibiciones P0, comandos oficiales, Definition of Done y enlaces a reglas. El detalle va en archivos importados para no saturar cada sesión. Los subdirectorios `apps/api` y `apps/web` tendrán `CLAUDE.md` propios con reglas locales.
