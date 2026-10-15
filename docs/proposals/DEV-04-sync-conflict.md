# SUPERSEDED — DEV-04 SYNC_CONFLICT

> **Estado: SUPERSEDED (2026-10-15).** Decisión del usuario: el conflicto de sincronización de DEV-04 usa **el mismo mecanismo que la entrega de Alquiler (ENTREGA-04)**; **no habrá contrato backend nuevo** para Devolución. Ver DEC-DEV-SYNC-CONFLICT-001 en `docs/decision-log.md`. El texto siguiente se conserva solo como histórico y NO debe implementarse.

---

# Propuesta de contrato — DEV-04 SYNC_CONFLICT (checklist de recepción offline)

Estado: PROPUESTA (no implementada, `returns.yaml` sin cambios por esto). Fecha: 2026-10-15.

## 1. Qué dice el repositorio (y qué no)

Respaldado:
- UX v3.1 §4.1: estados `SYNCING`, `SYNC_CONFLICT`, `SYNCED`; DEV-04 es uno de los dos únicos formularios offline (checklist de recepción: 35 fotos, 3 videos, FIV/FCKE; "solo la confirmación del servidor cierra la sincronización").
- SDD-00 §17.2: al reconectar el dispositivo pide estado y versión del servidor; sin conflicto sincroniza; con conflicto "muestra comparación y exige resolución".
- SDD-00 §17.3/17.4 (matriz de conflicto): Checklist = campos distintos se combinan (merge), el MISMO campo modificado por dos actores requiere resolución de un SUPERVISOR; Evidencias = aditivas, nunca se sobrescriben en silencio; archivo duplicado = comparar integridad, no duplicar; expediente ya confirmado/cancelado por otro = rechazar borrador incompatible. TTL de borrador 72 h; reintentos máx. 10 en 24 h.
- TDD-04 §14/15: todo comando mutable exige `If-Match` (412 `RETURN_VERSION_CONFLICT`) e `Idempotency-Key`.
- Prototipo aprobado `PROTO-ALQ-09-RESOLUCION-DE-CONFLICTO-SYNC-ENTREGA-1/2` (pantalla de ALQ-09): conflicto por TOMA fotográfica (zona + n.º de toma) con tres acciones: "Conservar la mía", "Conservar del servidor", "Combinar (ambas fotos)" (una principal + una anexo con sellos de tiempo independientes). Muestra autor, dispositivo, fecha/hora, hash y tamaño de cada versión, id de auditoría `SYNC-ERR-*`.

NO respaldado (por eso no se implementa):
1. No existe en el repo (base b79a821, ni en main/develop) ninguna implementación backend del patrón ALQ-09/TR-08: TR-08 se marcó "N/A (solo frontend)" en el plan maestro y no hay endpoint, tabla ni código de error `SYNC_CONFLICT`. No hay patrón que replicar.
2. El backend de Devolución no modela el checklist por campo: `complete-inspection` solo valida conteos de evidencia (35 fotos/3 videos) y documento de responsabilidad; `return_evidences` guarda `zone`, `type`, `objectUrl`, sin hash ni n.º de toma ni versión por ítem. FIV/FCKE (formatos 01/08) no están como campos del servidor.
3. No hay ningún prototipo `PROTO-DEV-*` con estado `CONFLICT` (los de DEV-04 son SYNCED / OFFLINE / SYNCING).
4. No se define quién puede resolver el conflicto en DEV-04 (la matriz dice "supervisor" sin mapearlo a un rol/acción ADM-02; el catálogo de acciones no admite acciones inventadas).

## 2. Contrato propuesto (borrador, sujeto a las respuestas de §3)

Alcance mínimo defendible por los docs: conflicto de EVIDENCIA por (returnId, zone, slot) y de ESTADO del expediente. Los campos de checklist (kilometraje, combustible, FIV/FCKE) quedan fuera hasta responder §3.

### 2.1 Detección (sin endpoint nuevo de lectura)
El dispositivo envía cada evidencia pendiente a `POST /returns/{id}/evidence` (existente) añadiendo:
- `clientCaptureId` (uuid generado offline; idempotencia por captura), `slot` (n.º de toma dentro de la zona), `contentHash` (sha-256), `capturedAt`, `deviceId`.
Reglas del servidor:
- mismo `clientCaptureId` o mismo `contentHash` en (returnId, zone, slot) -> 200 idempotente, no duplica.
- slot libre -> 201 (aditivo).
- slot ocupado con otro `contentHash` -> `409 SYNC_CONFLICT` `{statusCode, code:'SYNC_CONFLICT', detail, conflictId}` y se persiste el candidato local como conflicto abierto (el servidor NO sobrescribe).
- devolución en estado terminal/incompatible (CERRADA, CANCELADA) -> `409 SYNC_DRAFT_REJECTED` (SDD §17.3 "rechazar borrador incompatible").
- borrador > 72 h -> `422 SYNC_DRAFT_EXPIRED`.

### 2.2 Endpoints
- `GET /returns/{id}/sync-conflicts?status=OPEN` -> lista `[{conflictId, zone, slot, local:{...capturedBy, deviceId, capturedAt, hash, sizeBytes, objectUrl}, server:{...}, divergenceSeconds, auditRef:'SYNC-ERR-xxxx', status, version}]`.
- `POST /returns/{id}/sync-conflicts/{conflictId}/resolve` (headers `If-Match` = versión del conflicto, `Idempotency-Key`), body `{resolution: 'KEEP_LOCAL'|'KEEP_SERVER'|'MERGE_BOTH', note}`:
  - KEEP_LOCAL: la evidencia local pasa a principal; la del servidor queda archivada (no se borra: auditoría).
  - KEEP_SERVER: se descarta la local (queda en auditoría).
  - MERGE_BOTH: una principal + una anexo secundario, ambas con su sello de tiempo (según prototipo).
  - 412 `SYNC_CONFLICT_VERSION_MISMATCH`, 409 `SYNC_CONFLICT_ALREADY_RESOLVED`, 403 si el rol no está autorizado.
- Efecto en cierre: `complete-inspection` rechaza con `409 SYNC_CONFLICT_PENDING` mientras existan conflictos OPEN.

### 2.3 Persistencia
Tabla `return_sync_conflicts` (id, organization_id, operating_company_id, return_id, zone, slot, local_evidence jsonb, server_evidence_id, status OPEN|RESOLVED, resolution, resolved_by, resolved_at, note, version, created_at) + columnas `slot`, `content_hash`, `client_capture_id`, `captured_at`, `device_id` en `return_evidences` (unique parcial `(return_id, client_capture_id)`). Migración manual; índices <= 63 caracteres.

## 3. Preguntas concretas que faltan (bloquean la implementación)
1. ¿Qué datos del checklist de recepción pueden entrar en conflicto en el servidor además de fotos/videos? ¿Se persisten por campo (km, combustible, ítems FIV/FCKE)? Si sí, ¿cuál es el modelo y la lista de campos?
2. ¿El conflicto de DEV-04 es solo por foto/toma como en ALQ-09 (prototipo) o también por campos de formulario (la matriz exige merge por campo y supervisor para el mismo campo)?
3. ¿Quién resuelve? "Supervisor" ¿es GERENCIA, JEFE_OPERACIONES u otro? ¿Existe (o se crea) una acción ADM-02, p. ej. `RETURN.RESOLVE_SYNC_CONFLICT`? (hoy no hay acciones libres en el catálogo).
4. ¿La opción "Combinar (ambas)" también aplica a videos, o solo a fotos? ¿Cómo cuentan para el mínimo 35+3 la principal y el anexo?
5. ¿Se confirma que el cliente móvil calculará `contentHash` sha-256 y `clientCaptureId` (el repo no define el protocolo del lado cliente ni lo hay en TR-08)?
6. ¿Se confirma que un conflicto OPEN debe bloquear `complete-inspection` (propuesta nuestra, no está en los docs)?
7. ¿Hay prototipo aprobado de la pantalla de conflicto de DEV-04 o se reutiliza la de ALQ-09?
