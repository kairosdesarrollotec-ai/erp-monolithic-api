> **DEPRECATED (bootstrap Claude Code, 2026-09-14).** Este comando legacy del blueprint v1.2 fue migrado. Usar en su lugar: `.claude/skills/frontend-screen/SKILL.md`. Este archivo se conserva solo como referencia historica del blueprint original; no se invoca en el framework vigente.

---
description: Implementa una pantalla KAIROS trazada a UX/UI, contratos y JPG/PNG aprobado.
argument-hint: --task-id <id> --ux-id <id> [--visual-refs <PROTO-ID,...>]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

Ejecuta WF-FE-01 completo. Antes de editar usa `kairos-source-preflight`; analiza cada imagen aprobada, resuelve BDD/SDD/TDD/OpenAPI, detén contradicciones, mapea Design System e implementa React con el stack aprobado. Completa estados/responsive, prueba, captura, ejecuta `kairos-responsive-visual` y actualiza evidencia. No apruebes ni reemplaces el baseline.
