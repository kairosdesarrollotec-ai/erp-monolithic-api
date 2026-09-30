# CONFLICT-FLO-001 — Almacenamiento de fotos de catálogo del módulo Fleet

**Código STOP:** `MISSING_SOURCE` + `UNAPPROVED_DEVIATION`
**Fecha de registro:** 2026-09-29
**Estado:** RESUELTO — PROP-008 aprobado por el usuario el 2026-09-30. Ver `decision-log.md`.
**Alcance bloqueado:** implementación del finding #5 del PR#34 (foto de vehículo en `NewVehicleModal.tsx` / endpoint `POST /vehicles`)

---

## 1. Fuentes involucradas

| Fuente | Versión/estado | Lo que dice |
|--------|---------------|-------------|
| SDD-00-Transversal §16.5 | Candidato | GCS como almacén de binarios; módulo propietario explícito = **Evidence**; JPEG/WebP máx 12 MB; patrón carga directa con sesión autorizada |
| ADR-KAI-005 (`APROBADA_ARQUITECTURA`) | Aprobada | Carga directa a GCS con URL firmada; la API guarda **solo metadatos**; contexto explícito: expediente de Alquiler/Devolución (35 fotos + 3 videos) |
| TDD-00 TD-009 (`DECIDIDO`) | Aprobado | GCS `southamerica-east1`, binarios fuera de la API; contexto: evidencia de alquiler/devolución |
| source-manifest.yaml | — | **No existe** TDD, SDD ni BDD específico para el módulo Fleet |
| decision-log.md | — | **Ninguna decisión** sobre el patrón de almacenamiento de fotos de catálogo de vehículos |

## 2. Descripción de la contradicción

El código implementado en `NewVehicleModal.tsx` (frontend) y `CreateVehicleDto` / `UpdateVehicleDto` (backend) guarda la foto del vehículo como un `data: URL` (`data:image/jpeg;base64,...`) directamente en PostgreSQL, validado solo con `@IsString()`.

Esto contradice la arquitectura transversal (ADR-KAI-005 + SDD §16.5) que establece que los binarios **no deben pasar por la API principal** y **no deben persistirse en la base de datos relacional**. Sin embargo, ese ADR y esa sección se refieren explícitamente al módulo **Evidence** (expediente de alquiler/devolución), no al módulo **Fleet**.

No existe una fuente aprobada que:
- Extienda ADR-KAI-005 al módulo Fleet para fotos de catálogo.
- Autorice explícitamente una excepción al patrón (p. ej. que fotos de catálogo pequeñas puedan ser almacenadas en la BD).

## 3. Parte del trabajo afectada

- `apps/erp-portal-web/apps/web/src/app/fleet/NewVehicleModal.tsx` — compresión canvas → data URL (finding #5 de PR#34).
- `apps/erp-monolithic-api/apps/api/src/modules/fleet/presentation/http/dto/create-vehicle.dto.ts` — `@IsString() photoUrl` sin validación de formato, tamaño ni MIME.
- `apps/erp-monolithic-api/apps/api/src/modules/fleet/presentation/http/dto/update-vehicle.dto.ts` — misma situación.
- Columna `vehicles.photo_url` en PostgreSQL — puede contener data URLs de cientos de KB.

No afecta el módulo Evidence ni ningún otro módulo ya construido.

## 4. Propuesta técnica para la decisión del equipo

Se presentan dos alternativas. Ambas eliminan el data URL de la BD.

### Opción A — Aplicar ADR-KAI-005 a Fleet (recomendada)

Extender el patrón aprobado al módulo Fleet mediante un endpoint dedicado:

```
POST /vehicles/photo-upload-sessions
→ { uploadUrl: string, objectKey: string }   # URL firmada de GCS (~15 min)

# El frontend sube directamente a GCS con PUT al uploadUrl

PATCH /vehicles/:id (o PUT al crear)
→ body: { ..., photoUrl: "https://storage.googleapis.com/..." }  # solo la URL GCS
```

**Validación en servidor:**
- El backend verifica que `photoUrl` sea una URL de GCS del bucket configurado (no un data URL ni URL externa arbitraria).
- Validación de tamaño (máx 12 MB), MIME por firma mágica (bytes 0-12 del objeto vía GCS metadata), y dimensiones opcionales.

**Cambios mínimos:**
- Nuevo endpoint `POST /vehicles/photo-upload-sessions` en el módulo Fleet.
- `photoUrl` en `CreateVehicleDto`/`UpdateVehicleDto` pasa de `@IsString()` a `@IsUrl({ protocols: ['https'] })` + validación de dominio GCS.
- Migración forward: columna `photo_url` se mantiene `VARCHAR`, se agrega CHECK `NOT LIKE 'data:%'`.
- Frontend: eliminar lógica de canvas/data URL; usar URL firmada para subir y guardar solo la URL GCS.

**Pro:** alinea Fleet con la arquitectura transversal; aprovecha GCS (sin CDN global, conforme a TDD-00 §9.1).
**Contra:** requiere implementar el endpoint de sesión de carga para Fleet (trabajo adicional).

### Opción B — URL externa validada (sin sesión de carga)

Aceptar que `photoUrl` es una URL HTTPS externa (e.g. GCS URL pública o firmada de largo plazo), validada solo por formato y dominio permitido. La carga del archivo se hace por otro canal (ej. consola GCS, otro servicio).

**Pro:** mínimo cambio de backend.
**Contra:** no controla el ciclo de vida del objeto; no alinea con el patrón de sesiones de carga; expone el bucket a cargas no auditadas; más difícil de auditar y de migrar en producción.

---

## 5. Decisión requerida

**¿Cuál opción se aprueba?**

- [ ] Opción A — Aplicar ADR-KAI-005 a Fleet con endpoint `POST /vehicles/photo-upload-sessions`.
- [ ] Opción B — Solo validar que `photoUrl` sea URL HTTPS del bucket GCS, sin sesión de carga.
- [ ] Otra solución (describir).

**Aprobado por:** _pendiente_
**Fecha:** _pendiente_

---

## 6. Referencias

- `apps/erp-monolithic-api/docs/sources/sdd/sdd-00-transversal.md` §16.5
- `apps/erp-monolithic-api/docs/sources/sdd/sdd-00-transversal.md` ADR-KAI-005 (~línea 1003)
- `apps/erp-monolithic-api/docs/sources/tdd/tdd-00-transversal.md` TD-009
- `apps/erp-monolithic-api/docs/decision-log.md`
- `apps/erp-portal-web/apps/web/src/app/fleet/NewVehicleModal.tsx` (líneas 61-116)
- `apps/erp-monolithic-api/apps/api/src/modules/fleet/presentation/http/dto/create-vehicle.dto.ts` (línea 62)
