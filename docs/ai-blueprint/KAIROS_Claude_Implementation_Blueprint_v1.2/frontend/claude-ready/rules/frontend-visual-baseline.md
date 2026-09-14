# Frontend visual baseline

Aplica a toda creación o modificación de páginas y componentes visuales KAIROS.

1. Exige UX-ID y al menos un PROTO-ID `APPROVED` vigente en `docs/prototype-manifest.yaml`.
2. Verifica archivo, SHA-256, versión, estado visual y viewport antes de editar.
3. El JPG/PNG gobierna composición y apariencia de su estado/viewport; UX/UI gobierna interacción, estados, responsive y accesibilidad; BDD/SDD/TDD/OpenAPI gobiernan negocio, flujo y contratos.
4. Nunca infieras desde la imagen un endpoint, campo, dato, rol, permiso, transición o regla.
5. Completa estados no visibles con UX/UI y Design System, conservando el lenguaje visual.
6. Genera captura y diff; el implementador no aprueba su propio resultado ni actualiza baselines.
7. WCAG 2.2 AA prevalece sobre defectos del prototipo y exige desviación documentada.
8. Aplica STOP codes de `frontend/06_Comandos_Frontend.md`.
