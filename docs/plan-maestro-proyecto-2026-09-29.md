# Plan Maestro — KAIROS/VeloxRent ERP (estado real al 11-oct-2026)

> Actualizado el 2026-10-11 cruzando módulos reales en `main` contra documentación de negocio.
> Versión anterior: 30-sep-2026.

## 1. Resumen ejecutivo

El proyecto completó en main los 6 módulos de negocio del MVP core: Consulta, Reserva, Alquiler, Devolución, Reclutamiento y Administración de Personal. También están completos Flota, Clientes, Admin/Soporte, Incidencias y el módulo de Plantillas de documentos.

**Estado actual (11-oct-2026):**
- **11 módulos de negocio** completamente implementados y mergeados a `main`.
- **Backend**: 21 módulos NestJS activos en `apps/api/src/modules/`.
- **Frontend**: 16 áreas funcionales activas en `apps/web/src/app/`.
- **Pendiente principal**: TR-08 (offline), TR-09 (perfil frontend), reportes, pagos standalone, búsqueda global.

Desde la versión anterior del plan (30-sep) se completaron:
- Alquiler (ALQ-01..11): mergeado backend + frontend.
- Devolución (DEV-01..10): construido e mergeado — estaba "sin empezar".
- Incidencias (INC-01/02): construido e mergeado.
- Reclutamiento (REC-01..08): construido e mergeado — estaba "sin empezar".
- Administración de Personal (ADP-01..09): construido e mergeado — estaba "sin empezar".
- Templates de documentos: módulo standalone backend (`templates`, `document-templates`, `notification-templates`), pantalla ADM-03 frontend.
- Roles dinámicos (ROLES-DIN-03): eliminación de legacy-role-policy, usePermissions unificado.
- Seguridad: rate limiting global (`@nestjs/throttler`), cabecera CSP, fix CRITICAL handlebars CVE.

---

## 2. Estado real por módulo

| Módulo | Doc | Backend | Frontend | Pendiente |
|--------|-----|---------|----------|-----------|
| **Consulta (CON-01..04)** | ✅ | ✅ | ✅ Incluye conversión a Alquiler directo | — |
| **Reserva (RES-01..08)** | ✅ | ✅ | ✅ | — |
| **Alquiler (ALQ-01..11)** | ✅ | ✅ mergeado | ✅ mergeado | BR-ALQ-013 falta grave; subida real evidencia; RENIEC/MTC real; modo offline ENTREGA-04 |
| **Devolución (DEV-01..10)** | ✅ | ✅ mergeado | ✅ mergeado | — |
| **Reclutamiento (REC-01..08)** | ✅ | ✅ mergeado | ✅ mergeado | — |
| **Personal/RRHH (ADP-01..09)** | ✅ | ✅ mergeado | ✅ mergeado 11-oct | — |
| **Flota (FLO-01/02)** | ✅ | ✅ | ✅ | Rama `feat/fleet-gcs-photo-upload` pendiente de evaluar (subida GCS con URL firmada) |
| **Clientes (CLI-01/02)** | ✅ | ✅ | ✅ | — |
| **Admin/Soporte (ADM-01..05)** | ✅ | ✅ | ✅ incl. ADM-03 plantillas | ADM-02 enforcement real de roles — pendiente de verificación |
| **Incidencias (INC-01/02)** | ✅ | ✅ | ✅ | — |
| **Plantillas de documentos** | ✅ TDD-TPL v1.0 | ✅ módulo standalone | ✅ ADM-03 | — |
| **TR-01 a TR-05** (auth/sesión) | ✅ | ✅ | ✅ | — |
| **TR-06 (Tablero por rol)** | ✅ 7 roles | ✅ | ⚠️ Funcional para todos los roles ya construidos; datos reales disponibles | Roles de módulos no construidos aún (reportes, pagos) |
| **TR-07 (Notificaciones)** | ✅ | ⚠️ Registro interno completo; correo de bienvenida vía Resend | ⚠️ Parcial | Despachador general de notificaciones |
| **TR-08 (Offline sync)** | ✅ | ✅ N/A (solo frontend) | ✅ mergeado 11-oct | — |
| **TR-09 (Perfil/sesión)** | ✅ | ⚠️ Parcial | ❌ Sin frontend dedicado | Frontend de perfil de usuario |
| **TR-10 (Control de acceso)** | ✅ | ⚠️ Parcial | ✅ usePermissions unificado (ROLES-DIN-03) | Verificar enforcement completo en backend |
| **TR-11 / HU-25 (Hub módulos)** | ✅ | ✅ | ✅ | — |
| **Pagos y garantías (PAG-01/02)** | ✅ BDD/SDD/TDD v1.0 draft — `payments.yaml` v0.1.0 | ❌ Sin módulo standalone | ❌ | Módulo NestJS `payments` → frontend |
| **Reportes (REP-01)** | ✅ BDD/SDD/TDD v1.0 draft — `reporting.yaml` v0.1.0 | ❌ | ❌ | Módulo NestJS `reporting` → frontend |
| **Búsqueda global (BUS-01)** | ✅ BDD/SDD/TDD v1.0 draft — `search.yaml` v0.1.0 — prototipos APPROVED | ❌ Sin módulo standalone | ❌ | Módulo NestJS `search` → componente `GlobalSearch` |

### 2.1 Gaps conocidos — Alquiler

- **BR-ALQ-013 (falta grave en ampliación)**: cliente no cumple los 4 requisitos → retener toda la garantía + evaluar proceso penal + marcar cliente "rojo". No implementado.
- **Subida de evidencia real (fotos/videos)**: `complete-delivery` actual solo acepta contadores. No hay endpoint de archivos.
- **RENIEC/MTC**: verificación simulada en UI, sin integración real en backend.
- **Modo offline ENTREGA-04**: depende de TR-08.

### 2.2 Seguridad — estado actual

- ✅ Rate limiting global (`@nestjs/throttler`).
- ✅ Content-Security-Policy header.
- ✅ handlebars CRITICAL CVE resuelto (override `4.7.10`).
- ✅ NestJS v10→v12, firebase-admin v12→v14.
- ⚠️ `sprintf-js` MODERATE (devDep, en allowlist hasta 2027-01-06).
- `npm run audit:prod` → 0 vulnerabilidades en producción.

---

## 3. Discrepancias activas

1. **ADM-02 (Roles y permisos)**: enforcement real pendiente de verificación puntual. El sistema usa roles dinámicos (ROLES-DIN-03) pero no se ha auditado que todos los guards apliquen el nuevo modelo consistentemente.
2. **TR-06 Tablero**: funcional para los roles ya construidos; cuando se construyan Reportes y Pagos el tablero necesitará widgets adicionales.
3. **Rama `feat/fleet-gcs-photo-upload`**: mejora de Flota sin mergear. No hay bloqueo técnico — pendiente de decisión de PR.
4. **TR-08 bloqueador concreto**: ENTREGA-04 de Alquiler queda online-only sin esto.

---

## 4. Plan de fases — actualizado

**Fase 0 — ✅ COMPLETADA:**
TR-01..05, TR-06 (funcional), TR-07 (parcial), TR-11, Consulta, Reserva, Flota, Clientes, Admin/Soporte, Plantillas de documentos.

**Fase 1 — ✅ COMPLETADA:**
Alquiler (ALQ-01..11) backend + frontend, mergeados.

**Fase 2 — ✅ COMPLETADA:**
Devolución (DEV-01..10), Incidencias (INC-01/02).

**Fase 3 — ✅ COMPLETADA (inesperadamente adelantada):**
Reclutamiento (REC-01..08), Administración de Personal (ADP-01..09), Roles dinámicos.

**Fase 4 — ✅ COMPLETADA (11-oct-2026):**
- ✅ TR-09 modal logout con borradores pendientes (frontend). `PROTO-TR-09-MODAL-CERRAR-SESION-CON-FORMULARIOS-PEND`. 15/15 tests.
- ✅ ADM-02: `FirebaseAuthGuard` registrado como `APP_GUARD` global + `@Public()` para `/health` y `POST /audit/login-attempts`.
- ✅ Endpoint subida evidencia (fotos/videos GCS): YA estaba implementado en `Stage4ChecklistScreen` y `ChecklistScreen` (online-only).
- ✅ BR-ALQ-013 (falta grave en ampliación): mergeado en PR #80, ya en `main`.
- ✅ `feat/fleet-gcs-photo-upload`: commit `4cab799` ya en `main`.
- ✅ TR-07: filtro `aggregate_type = 'Reservation'` eliminado del OutboxRelay; 7 nuevos event types en el projector; 1169/1169 tests.

**Fase 5 — ✅ COMPLETADA (11-oct-2026):**
- ✅ TR-08 (offline sync ALQ-09/DEV-04): `dexie@4.0.10` + `vite-plugin-pwa@1.3.0`; infraestructura `src/offline/` completa; ALQ-09 (19 tests) y DEV-04 (32 tests). Commit `8639207`.
- ✅ PAG-01/02 y REP-01: BDD/SDD/TDD v1.0 draft creados (11-oct-2026). Permisos `PAYMENT.*` y `REPORT.*` agregados al catálogo. Prototipos HTML `PENDING_REVIEW` en prototype-manifest.yaml.
  - ⚠️ Pendiente: revisión formal de fuentes, aprobación de prototipos por PRODUCTO, formalización de contratos OpenAPI antes de implementar backend/frontend.

**Fase 6 — EN PROGRESO:**
- ✅ PAG-01/02: BDD/SDD/TDD v1.0 draft + contrato `payments.yaml` v0.1.0. Prototipos APPROVED. Permisos `PAYMENT.*` en catálogo. **STOP MISSING_API_CONTRACT resuelto.** Listo para: módulo NestJS `payments` → generación cliente → frontend.
- ✅ REP-01: BDD/SDD/TDD v1.0 draft + contrato `reporting.yaml` v0.1.0. Prototipo APPROVED. Permisos `REPORT.*` en catálogo. **STOP MISSING_API_CONTRACT resuelto.** Listo para: módulo NestJS `reporting` → generación cliente → frontend.
- ✅ Búsqueda global (BUS-01): BDD/SDD/TDD v1.0 draft + contrato `search.yaml` v0.1.0. Prototipos APPROVED. **STOP MISSING_API_CONTRACT resuelto.** Listo para: módulo NestJS `search` → generación cliente → componente `GlobalSearch`.
- ✅ RENIEC/MTC: **excluidas del MVP** por decisión formal `DEC-MVP-RENIEC-MTC-EXCL-2026-10-11` en `decision-log.md`. No se implementarán integraciones reales hasta post-MVP con ADR aprobado.
- Expansión multisede en módulos pendientes.

---

## 5. Próximos pasos inmediatos sugeridos

1. **TR-08**: verificar que los agentes en curso completen ALQ-09 y DEV-04 con offline funcional y tests verdes.
2. **PAG-01/02 y REP-01**: requieren documentación BDD/SDD/TDD antes de poder implementarse.
3. **Seguir actualizando este documento al cierre de cada sesión relevante.**
