# Trazabilidad — artifacts/traceability/

Un archivo por slice implementado: `artifacts/traceability/<modulo>/<task_id>.md`, generado por la skill `traceability-update` al finalizar una implementacion.

Cada archivo enlaza la cadena completa:

```
BDD -> SDD -> TDD -> UX-ID -> PROTO-ID -> OpenAPI -> codigo -> pruebas -> evidencia
```

No se declara un slice terminado si algun eslabon de esta cadena no resuelve a un archivo o ID real. El agente `traceability-guardian` audita esta carpeta en modo solo lectura; no la actualiza (esa responsabilidad es de la skill `traceability-update`, invocada por el implementador al cerrar el slice).

Al momento del bootstrap (2026-09-14) esta carpeta esta vacia: no hay slices de producto implementados todavia (`apps/web` y `apps/api` estan vacios). El primer archivo aqui debe corresponder al primer slice vertical que se implemente.
