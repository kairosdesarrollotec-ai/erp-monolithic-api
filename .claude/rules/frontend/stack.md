---
description: Stack frontend inmutable y prohibiciones. Aplica a apps/web/**.
paths: ['apps/web/**']
---

# Stack frontend obligatorio (apps/web/**)

React SPA/PWA, TypeScript, Vite, React Router, TanStack Query (server state), Zustand (solo estado cliente verdaderamente global), React Hook Form + Zod, cliente generado desde OpenAPI, Radix UI, CSS Modules, Lucide, date-fns, TanStack Table. Pruebas: Vitest, Testing Library, MSW, Playwright, axe. Observabilidad: Sentry.

Workbox y Dexie unicamente para `ALQ-09` y `DEV-04` (offline aprobado).

**Next.js esta expresamente excluido.**

No agregar otro framework de routing, formularios, validacion, estado remoto, estado global o libreria de componentes sin una decision arquitectonica aprobada y registrada en `docs/decision-log.md`.
