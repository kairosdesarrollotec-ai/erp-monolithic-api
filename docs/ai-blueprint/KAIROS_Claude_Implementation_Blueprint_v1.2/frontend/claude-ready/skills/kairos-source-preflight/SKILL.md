---
name: kairos-source-preflight
description: Valida fuentes documentales, baselines visuales y alcance antes de todo cambio KAIROS.
---

# Preflight

1. Lee `source-manifest.yaml`, `prototype-manifest.yaml` y task brief.
2. Exige `source_refs`, `visual_refs` para UI y `allowed_paths`.
3. Comprueba UX-ID/PROTO-ID, estado `APPROVED`, archivo, hash, versión, estado visual y viewport.
4. Resuelve BDD/SDD/TDD/OpenAPI y detecta contradicciones.
5. Devuelve PASS o STOP normativo; no selecciona fuentes aproximadas ni edita producto.

STOP: fuente vacía/contradictoria, baseline faltante/superado, suposición material o cambio fuera de alcance.
