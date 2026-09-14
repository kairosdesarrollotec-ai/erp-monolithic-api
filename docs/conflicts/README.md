# Conflictos documentales — docs/conflicts/

Cada archivo `CONFLICT-<modulo>-<numero>.md` registra una contradiccion material entre dos o mas fuentes autorizadas (BDD/SDD/TDD/OpenAPI/UX-UI/prototipo), detectada por la skill `conflict-detection` y formalizada por el agente `conflict-reviewer`.

Un conflicto material afecta: una regla de negocio, un dato, un permiso, un contrato o un flujo. Una diferencia de redaccion sin impacto no se registra aqui.

## Formato de cada archivo

```
# CONFLICT-<modulo>-<numero>

- Fuentes en conflicto: [ID version, ID version]
- Descripcion: ...
- Alcance afectado: ...
- Pregunta concreta: ...
- Alternativas y consecuencias: ...
- Estado: OPEN | RESOLVED
- Resolucion (si aplica): referencia a docs/decision-log.md
```

Ningun agente marca por si mismo un conflicto propio como `RESOLVED`. La resolucion requiere una decision humana registrada en `docs/decision-log.md`.

Al momento del bootstrap (2026-09-14) no hay conflictos abiertos: los 3 conflictos historicos del blueprint (`DOC-CONFLICT-001/002/003`) ya estan resueltos y documentados en `docs/decision-log.md`.
