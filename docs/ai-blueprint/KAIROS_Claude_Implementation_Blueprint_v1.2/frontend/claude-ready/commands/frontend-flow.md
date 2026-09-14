> **DEPRECATED (bootstrap Claude Code, 2026-09-14).** Este comando legacy del blueprint v1.2 fue migrado. Usar en su lugar: `.claude/skills/frontend-flow/SKILL.md`. Este archivo se conserva solo como referencia historica del blueprint original; no se invoca en el framework vigente.

---
description: Valida un user flow frontend por rol y su cobertura visual.
argument-hint: --flow-id <id> --role <role>
allowed-tools: Read, Grep, Glob, Write, Bash
---

Resuelve todos los UX-ID del flujo. Verifica continuidad, rutas, contexto heredado, presupuesto de interacción, permisos, estados, baselines e implementación. Falla ante callejón sin salida, repetición innecesaria o pantalla no trazada. Solo escribe evidencia.
