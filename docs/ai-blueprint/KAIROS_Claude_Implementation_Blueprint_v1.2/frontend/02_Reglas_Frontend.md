# Reglas Claude — Frontend

## Stack y estructura

- React SPA/PWA con TypeScript 5.9.x, Vite y React Router, desplegada en Firebase Hosting.
- **Sin Next.js** según TDD Transversal v3.4.
- Features: `inquiries`, `reservations`, `rentals`, `returns`, `recruitment`, `hr-administration`; capacidades compartidas aisladas.
- Cliente y tipos generados desde OpenAPI 3.1.
- TanStack Query para server state; Zustand solo para estado cliente transversal.
- React Hook Form + Zod para formularios y validación cliente.
- `vite-plugin-pwa` + Workbox para PWA; Dexie/IndexedDB solo para ALQ-09 y DEV-04.
- Radix UI Primitives, CSS Modules/Custom Properties, Lucide React, date-fns y TanStack Table.
- Vitest, Testing Library, user-event, MSW, Playwright y axe; Sentry para observabilidad.
- Dependencias nuevas o sustituciones requieren ADR; usar primero la base aprobada del repositorio.

## Propiedad del estado

| Estado | Propietario | Prohibición |
|---|---|---|
| Datos y cache de API | TanStack Query | No duplicar respuestas completas en Zustand |
| Campos/dirty/errors de formulario | React Hook Form | No almacenar formularios en Zustand |
| Preferencias y shell | Zustand | No contener tokens, PII o entidades remotas |
| Ruta y parámetros navegables | React Router | No crear un router paralelo en stores |
| Borrador offline autorizado | Dexie/IndexedDB | Solo ALQ-09/DEV-04; cifrado y aislado |
| Component state | React | No elevarlo globalmente sin consumidor real |

Las versiones exactas quedan bloqueadas en el lockfile. Un agente no actualiza major versions ni cambia de librería sin ADR.

## Fuentes

- BDD decide comportamiento y lenguaje de negocio.
- TDD/OpenAPI decide contratos técnicos.
- UX/UI v3.1 decide layout, interacción, responsive, accesibilidad y stack de soporte formalizado.
- Para toda pantalla visual, el JPG/PNG `APPROVED` asociado al `UX-ID` es fuente obligatoria y autoridad sobre composición, jerarquía, orden visual, contenido visible y apariencia del estado/viewport registrado.
- La imagen no crea reglas, datos, campos, endpoints, roles, permisos, transiciones ni comportamiento. BDD/SDD/TDD/OpenAPI prevalecen en esos aspectos.
- Adjuntar un archivo no lo aprueba: debe figurar vigente en `docs/prototype-manifest.yaml` con PROTO-ID, versión, estado, viewport, hash y aprobador.
- Prohibido implementar una pantalla final sin baseline aprobado, sustituirlo por interpretación libre o actualizarlo solo para hacer pasar una prueba.
- Estados y viewports no representados se completan con UX/UI y Design System, conservando el lenguaje visual.
- Conflicto material: `STOP_SOURCE_CONFLICT`; baseline ausente: `STOP_MISSING_BASELINE`; versión/hash no vigente: `STOP_STALE_BASELINE`.

## Experiencia

- Un CTA primario por etapa.
- Heredar empresa, sede, cliente, vehículo, periodo y modalidad válidos.
- Mantener filtros/orden al volver a la bandeja.
- Mostrar excepciones solo cuando aplican.
- Dashboard centrado en tareas, alertas, borradores y acciones por rol.
- Cumplir presupuestos de interacción de UX/UI v3.
- Toda operación termina con estado persistente y siguiente acción; toast no es única evidencia.
- No eliminar pasos legales, MFA, evidencia, autorización ni confirmación irreversible para reducir clics.

## Estados obligatorios

`INITIAL`, `LOADING`, `EMPTY`, `READY`, `DIRTY`, `VALIDATING`, `SAVING`, `SUCCESS`, `RECOVERABLE_ERROR`, `BLOCKING_ERROR`, `FORBIDDEN`, `SESSION_EXPIRED`, `STALE_VERSION`, `EXTERNAL_DEPENDENCY_PENDING`, `OFFLINE_READ_ONLY`, y donde corresponda `LOCAL_DRAFT`, `SYNCING`, `SYNC_CONFLICT`, `SYNCED`.

Cada llamada debe representar loading, éxito, error recuperable, bloqueo y sesión/permiso. Prohibido dejar pantallas blancas o spinner indefinido.

## Diseño UI

- Usar exclusivamente tokens de UX/UI v3; no hex/radio/sombra arbitrarios.
- Inter y escala tipográfica definida.
- Lucide como librería candidata única mientras no exista decisión posterior.
- Controles estándar 48 px; táctil mínimo 44×44 px.
- Tablas 52 px cómoda/40 px compacta; móvil en tarjetas o scroll controlado.
- Estados sensibles combinan icono, texto, color y acción.
- Formatos: `DD/MM/AAAA`, 24 h `America/Lima`, `S/ 1,250.00`, placa mayúscula, documentos enmascarados.
- La fidelidad se evalúa semántica y visualmente: estructura, jerarquía, secciones, CTA, componentes, tokens y tamaños relativos. Un porcentaje de píxeles nunca puede ocultar un CTA o estado crítico ausente.
- Una corrección necesaria para WCAG 2.2 AA prevalece sobre el defecto visual del baseline y exige desviación documentada.

## Aceptación visual

- Umbral inicial orientativo de diferencia automática: `≤2%`, configurable por tipo de pantalla.
- Cero diferencias críticas de estructura o jerarquía.
- Cero CTA primarios ausentes, duplicados o agregados sin fuente.
- Cero componentes fuera del Design System sin decisión registrada.
- `≤2%` no aprueba automáticamente; `>2%` exige revisión y no rechaza automáticamente.
- Veredictos: `PASS`, `PASS_WITH_APPROVED_DEVIATIONS`, `FAIL`, `STOP_SOURCE_CONFLICT`, `STOP_MISSING_BASELINE`, `STOP_STALE_BASELINE`.

## Responsive y móvil

- Validar 320–767, 768–1023, 1024–1439 y ≥1440 px.
- Móvil obligatorio: autenticación, Gerencia, notificaciones, ALQ-09, DEV-04 y ADP-06/07.
- Operación de campo: cámara primero, CTA fijo, uso a una mano y progreso persistente.
- No reducir texto por debajo de 14 px para encajar tablas.

## Accesibilidad

- WCAG 2.2 AA; contraste 4.5:1 normal y 3:1 grande.
- HTML semántico antes de ARIA.
- Teclado completo, foco visible/lógico, skip link y restauración de foco.
- Label persistente; errores enlazados y resumen.
- Reflow 320 px, zoom 200%, reduced motion y lector de pantalla.
- No usar placeholder, color, icono o toast como único portador de información.

## Seguridad

- Backend autoriza; frontend solo adapta visibilidad y evita acciones inválidas.
- No almacenar tokens o PII sensible en `localStorage`.
- URL, logs, analytics y errores sin DNI completo, contratos, evidencias o tokens.
- Sanitizar contenido y evitar HTML crudo.
- Limpiar contexto y borradores según logout/sesión/usuario autorizado.

## Negocio P0 visible

- No mostrar hold ni cuenta regresiva provisional de Reserva.
- No expirar no-show automáticamente.
- MTC caído bloquea; RENIEC caído ofrece solicitud autorizada.
- Alcolímetro usa `FAVORABLE/DESFAVORABLE` con consecuencias correctas.
- GPS se traza a BR-ALQ-010; kilómetros incluidos a BR-ALQ-006.
- Daño grave se clasifica según BR-DEV-007; riesgo irreversible según BR-DEV-008.
- Sin cuarta autorización automática ADP.
