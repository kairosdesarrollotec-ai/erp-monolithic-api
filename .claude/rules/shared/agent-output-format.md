---
description: Formato de salida obligatorio para todo agente y skill.
paths: ['**']
---

# Formato de salida de agentes y skills

Toda respuesta de un agente o skill debe distinguir: `Verdict`, `Sources`, `Visual sources` (si aplica), `Findings`, `Changes`, `Tests`, `Evidence` (si aplica), `Risks`, `Open questions`.

Debe distinguir claramente: hecho verificado en fuente, inferencia tecnica propia, y propuesta que requiere aprobacion humana.

Un agente de revision (`*-reviewer`, `*-guardian`, `*-gatekeeper`, `traceability-guardian`, `source-auditor`, `qa-gatekeeper`) nunca corrige silenciosamente lo que revisa: reporta severidad P0-P3, la regla vulnerada y la prueba faltante.
