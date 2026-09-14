---
description: Autoridad del prototipo JPG/PNG aprobado y limites de inferencia visual. Aplica a toda creacion/modificacion de pantallas.
paths: ['apps/web/**', 'docs/prototypes/**']
---

# Baseline visual obligatorio

Aplica a toda creacion o modificacion de pantallas y componentes visuales KAIROS.

1. Exige `UX-ID` y al menos un `PROTO-ID` `APPROVED` vigente en `docs/prototype-manifest.yaml`.
2. Verifica archivo, `sha256`, version, estado visual y viewport antes de editar.
3. El JPG/PNG gobierna composicion y apariencia de su estado/viewport; UX/UI gobierna interaccion, estados, responsive y accesibilidad; BDD/SDD/TDD/OpenAPI gobiernan negocio, flujo y contratos.
4. Nunca se infiere desde la imagen un endpoint, campo, dato, rol, permiso, transicion o regla.
5. Se completan estados no visibles con UX/UI y Design System, conservando el lenguaje visual.
6. Se genera captura y diff (`responsive-visual`); el implementador no aprueba su propio resultado ni actualiza el baseline.
7. WCAG 2.2 AA prevalece sobre defectos del prototipo; exige desviacion documentada.
8. Aplican los codigos STOP de `.claude/rules/shared/stop-codes.md`.
