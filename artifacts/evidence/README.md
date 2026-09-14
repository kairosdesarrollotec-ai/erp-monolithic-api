# Evidencia — artifacts/evidence/

Evidencia de implementacion y validacion generada por las skills `responsive-visual`, `accessibility`, `frontend-testing` y `backend-testing`.

Convencion de carpetas: `artifacts/evidence/<ux_id-o-modulo>/<task_id>/` con:

- captura de la implementacion (por viewport/estado relevante);
- diff contra el `screen.png` del `PROTO-ID` vigente (cuando hay UI);
- `visual-implementation-evidence.yaml` (requirement_refs, design_refs, visual_refs, changed_contracts, changed_migrations, tests, security_checks, deviations);
- resultado real de las pruebas ejecutadas (no declaradas).

El implementador no aprueba su propia evidencia visual. Las desviaciones intencionales frente al baseline requieren aprobacion humana registrada aqui y referenciada desde `docs/decision-log.md` cuando cambian una decision de alcance.

Al momento del bootstrap (2026-09-14) esta carpeta esta vacia: no hay implementacion de producto todavia.
