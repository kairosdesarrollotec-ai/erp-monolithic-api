# Blueprint de Implementación Asistida por Claude — MVP KAIROS

**Versión:** 1.2  
**Fecha:** 10/09/2026  
**Propietario técnico:** Eder Ramos  
**Alcance:** Backend, migraciones PostgreSQL, API NestJS y frontend React SPA/PWA con stack formalizado.

## Propósito

Este paquete especifica qué agentes, reglas, skills, workflows, índices y artefactos deben crearse antes de implementar el MVP KAIROS con Claude Code. Su objetivo es limitar el espacio de decisión de la IA, hacer obligatoria la trazabilidad BDD → SDD → TDD → contrato → código → prueba y detener cualquier implementación sustentada en una suposición.

La versión 1.2 formaliza además que toda pantalla debe implementarse desde un `UX-ID` y uno o más prototipos JPG/PNG aprobados. La imagen es autoridad visual para el estado y viewport declarados; UX/UI gobierna interacción, estados y responsive; BDD/SDD gobiernan comportamiento y flujo; TDD/OpenAPI gobiernan contratos. Ninguna fuente visual puede crear reglas de negocio.

## Decisión técnica aplicable

La discrepancia de Next.js queda resuelta en SDD v3.6, TDD v3.4 y UX/UI v3.1. El frontend oficial es **React SPA/PWA + TypeScript + Vite + React Router**, sin Next.js. El ecosistema aprobado incluye TanStack Query, Zustand limitado, React Hook Form + Zod, cliente OpenAPI generado, Workbox, Dexie/IndexedDB acotado, Radix UI Primitives, CSS Modules/Custom Properties, Lucide React, date-fns, TanStack Table, Vitest/Testing Library/MSW/Playwright/axe y Sentry.

## Estructura entregada

```text
KAIROS_Claude_Implementation_Blueprint_v1.2/
├── README.md
├── shared/
│   ├── 01_Gobernanza_y_Autoridad_Documental.md
│   ├── 02_Arquitectura_Workspace_Index.md
│   └── 03_Trazabilidad_Gates_y_Operacion_Claude.md
├── backend/
│   ├── 01_Agentes_Backend.md
│   ├── 02_Reglas_Backend.md
│   ├── 03_Skills_Backend.md
│   ├── 04_Workflows_Backend.md
│   └── 05_Artefactos_Backend.md
└── frontend/
    ├── 01_Agentes_Frontend.md
    ├── 02_Reglas_Frontend.md
    ├── 03_Skills_Frontend.md
    ├── 04_Workflows_Frontend.md
    ├── 05_Artefactos_Frontend.md
    ├── 06_Comandos_Frontend.md
    ├── 07_Hooks_CI_y_Gates_Visuales.md
    ├── 08_Matriz_Impacto_Baseline_Visual.md
    ├── claude-ready/
    │   ├── agents/
    │   ├── commands/
    │   ├── rules/
    │   └── skills/
    └── templates/
        ├── prototype-manifest.example.yaml
        ├── frontend-screen-task.example.yaml
        └── visual-implementation-evidence.example.yaml
```

## Orden de creación en el repositorio real

1. Colocar las fuentes aprobadas bajo `docs/bdd`, `docs/sdd`, `docs/tdd`, `docs/ux-ui` y los JPG/PNG bajo `docs/prototypes/<modulo>/<UX-ID>/`.
2. Registrar cada imagen en `docs/prototype-manifest.yaml` con UX-ID, estado, viewport, versión, aprobación y hash.
3. Crear el manifiesto de fuentes, Decision Log y registro de discrepancias.
4. Crear `CLAUDE.md`, reglas, comandos y hooks compartidos/frontend.
5. Implementar el índice léxico/simbólico/documental mínimo y el catálogo de metadatos visuales.
6. Crear agentes y skills backend; producir primero OpenAPI, eventos y migraciones.
7. Crear agentes y skills frontend consumiendo OpenAPI generado y prototipos aprobados, nunca endpoints o interfaces inventados.
8. Ejecutar vertical slices en el orden aprobado: Consulta → Reserva → Alquiler → Devolución → Reclutamiento → Administración de Personal.

## Criterio de éxito

Claude puede implementar solo si cada cambio declara `source_refs`, alcance, archivos permitidos, contratos afectados, pruebas y resultado de gates. Ante contradicción, ausencia de evidencia o cambio de alcance debe detenerse y generar una pregunta/ADR; nunca completar el vacío por probabilidad.

Para UI, ninguna pantalla queda terminada sin: prototipo aprobado, implementación funcional, captura equivalente, comparación visual, estados obligatorios, responsive, accesibilidad y evidencia trazada.

Los archivos bajo `frontend/claude-ready/` son plantillas directamente trasladables a `.claude/`; deben ajustarse únicamente a los paths y herramientas reales del monorepo sin debilitar sus STOP conditions.
