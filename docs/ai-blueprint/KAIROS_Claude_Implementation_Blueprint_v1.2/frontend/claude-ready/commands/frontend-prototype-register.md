> **DEPRECATED (bootstrap Claude Code, 2026-09-14).** Este comando legacy del blueprint v1.2 fue migrado. Usar en su lugar: `.claude/skills/prototype-intake/SKILL.md`. Este archivo se conserva solo como referencia historica del blueprint original; no se invoca en el framework vigente.

---
description: Registra o versiona un JPG/PNG de prototipo sin autoaprobarlo.
argument-hint: --ux-id <id> --image <path> --state <state> --viewport <WxH> --version <semver>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Usa `kairos-prototype-intake`. Valida metadatos, PII, resolución y formato; calcula hash; crea PROTO-ID; registra `DRAFT` o `REVIEWED`. La transición a `APPROVED` requiere aprobación UX/UI independiente. Si reemplaza otro, marca el anterior `SUPERSEDED`.
