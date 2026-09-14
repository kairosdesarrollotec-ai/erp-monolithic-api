# .claude/ — Framework de trabajo Claude Code para KAIROS/VeloxRent

Este directorio NO implementa funcionalidades del producto. Es el framework que gobierna como Claude Code implementa frontend y backend, adaptado del blueprint en `docs/ai-blueprint/KAIROS_Claude_Implementation_Blueprint_v1.2/` a la estructura real del repositorio. Ver `artifacts/reports/claude-bootstrap-report.md` para el detalle completo de que se creo, adapto y descarto.

## Estructura

- `agents/shared/` — 8 agentes transversales de solo lectura (salvo `conflict-reviewer` e `index-maintainer`, que escriben unicamente su propio artefacto): `source-auditor`, `traceability-guardian`, `conflict-reviewer`, `release-gatekeeper`, `architecture-guardian`, `security-reviewer`, `qa-gatekeeper`, `index-maintainer`.
- `agents/frontend/` — 6 agentes: `frontend-slice-planner`, `design-system-engineer`, `react-feature-implementer`, `accessibility-reviewer`, `responsive-visual-reviewer`, `frontend-test-engineer`.
- `agents/backend/` — 6 agentes: `backend-slice-planner`, `domain-implementer`, `prisma-migration-reviewer`, `api-contract-reviewer`, `authorization-reviewer`, `backend-test-engineer`.
- `skills/` — 14 skills con `SKILL.md` (proposito, cuando usarla, entradas, fuentes, precondiciones, secuencia, STOP, salidas, validaciones, criterios de aceptacion, ejemplo).
- `rules/shared|frontend|backend/` — reglas por alcance, referenciadas desde el `CLAUDE.md` raiz en vez de repetidas ahi.
- `hooks/` — 4 scripts de bajo costo (solo revisan archivos afectados, nunca el repo completo) + `settings.json` los registra en `PostToolUse`.
- `settings.json` — registro de hooks.

## Convenciones

- Ningun agente de revision/auditoria tiene permiso de escritura sobre codigo de producto.
- El implementador nunca aprueba su propio cambio.
- Ningun hook ejecuta build completo, suite E2E completa, visual regression de todas las pantallas, migraciones, instalaciones, deployments ni `git push`.
- Ningun agente/skill inventa reglas, campos, estados, endpoints, permisos, pantallas ni flujos: todo sale de `docs/source-manifest.yaml`, `docs/prototype-manifest.yaml` o `docs/decision-log.md`.
- Formato de salida obligatorio: ver `.claude/rules/shared/agent-output-format.md`.

## Pendiente conocido (ver informe de bootstrap)

- Los hooks en `hooks/*.sh` asumen una variable de entorno `$CLAUDE_FILE_PATH` para el archivo afectado; esto no se verifico contra la documentacion oficial de hooks de Claude Code en esta sesion (sin acceso a esa fuente en el momento del bootstrap) — revisar y ajustar el nombre real de la variable/formato de entrada antes de confiar en estos hooks en produccion.
- `apps/web/CLAUDE.md` y `apps/api/CLAUDE.md` no se crearon todavia (decision explicita: se pospone hasta que exista codigo real en esas carpetas).
- 3 pantallas (busqueda global) y 11 assets fotograficos en `docs/prototype-manifest.yaml` quedan `PENDING_TRACE_REVIEW` por no tener un `UX-ID` canonico de 1:1 en la especificacion UX/UI v3.1.
