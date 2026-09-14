> **DEPRECATED (bootstrap Claude Code, 2026-09-14).** Este comando legacy del blueprint v1.2 fue migrado. Usar en su lugar: `.claude/skills/responsive-visual/SKILL.md`. Este archivo se conserva solo como referencia historica del blueprint original; no se invoca en el framework vigente.

---
description: Compara una implementación KAIROS con su baseline visual aprobado.
argument-hint: --ux-id <id> --proto-id <id> --route <route> --fixture <id>
allowed-tools: Read, Grep, Glob, Write, Bash
---

Usa `kairos-responsive-visual`: valida baseline, crea entorno determinista, captura, compara y revisa semánticamente estructura, jerarquía, CTA y Design System. Produce actual/diff/reporte/evidencia. No edites producto ni baseline. Emite solo veredictos normativos.
