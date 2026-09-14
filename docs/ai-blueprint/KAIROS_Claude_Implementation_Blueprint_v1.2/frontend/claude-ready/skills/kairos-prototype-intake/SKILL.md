---
name: kairos-prototype-intake
description: Registra y versiona prototipos JPG/PNG trazados sin autoaprobación.
---

# Prototype intake

Valida JPG/PNG, legibilidad, resolución, metadatos y ausencia de PII real. Exige UX-ID, estado, viewport y versión; genera PROTO-ID y SHA-256; actualiza el manifiesto como `DRAFT`/`REVIEWED`. Solo aprobación UX/UI independiente permite `APPROVED`. Reemplazos marcan el anterior `SUPERSEDED`; nunca borran historia.
