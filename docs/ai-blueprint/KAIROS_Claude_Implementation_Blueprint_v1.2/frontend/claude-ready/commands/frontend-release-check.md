> **DEPRECATED (bootstrap Claude Code, 2026-09-14).** Este comando legacy del blueprint v1.2 fue migrado. Usar en su lugar: `.claude/agents/shared/release-gatekeeper.md (mas los hooks de bajo costo en .claude/hooks/)`. Este archivo se conserva solo como referencia historica del blueprint original; no se invoca en el framework vigente.

---
description: Ejecuta el gate independiente de release frontend KAIROS.
argument-hint: --module <module> --release <id>
allowed-tools: Read, Grep, Glob, Write, Bash
---

Ejecuta WF-FE-08 y `G4-FE Visual Fidelity`: build, lint, typecheck, tests, contratos, seguridad, accesibilidad, PWA, cobertura visual, diffs y desviaciones. No modifica código o baselines. Emite `PASS`, `PASS_WITH_APPROVED_DEVIATIONS` o `FAIL` con evidencia.
