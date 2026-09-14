# CLAUDE.md — ERP KAIROS / VeloxRent

## 1. Propósito

Este repositorio contiene el ERP interno del Grupo KAIROS, conformado por:

- VeloxRent.
- Casa del Auto.
- Motrix.
- RENOVA.

Claude debe implementar funcionalidades únicamente a partir de fuentes
documentales trazables y aprobadas.

No debe inventar reglas de negocio, campos, estados, permisos, endpoints,
pantallas, flujos ni decisiones arquitectónicas.

---

## 2. Alcance del repositorio

La solución contiene:

- `apps/web/`: frontend React SPA/PWA.
- `apps/api/`: backend NestJS.
- `docs/sources/bdd/`: comportamiento y reglas de negocio.
- `docs/sources/sdd/`: diseño funcional y procesos.
- `docs/sources/tdd/`: arquitectura y diseño técnico.
- `docs/sources/ux-ui/`: navegación, interacción y estados de interfaz.
- `docs/prototypes/approved/`: prototipos visuales aprobados.
- `docs/source-manifest.yaml`: inventario de fuentes.
- `docs/prototype-manifest.yaml`: relación entre UX-ID y prototipos.
- `docs/decision-log.md`: decisiones aprobadas.
- `docs/conflicts/`: contradicciones pendientes.
- `artifacts/traceability/`: matrices de trazabilidad.
- `artifacts/evidence/`: evidencias de implementación y validación.

Si alguna ruta no existe, no asumir su contenido. Registrar la ausencia.

---

---

## 2.1 Framework Claude Code (.claude/)

Este `CLAUDE.md` contiene solo las instrucciones globales. El detalle operativo vive en:

- `.claude/agents/shared|frontend|backend/` — agentes especializados, permisos minimos, ver `.claude/README.md`.
- `.claude/skills/<nombre>/SKILL.md` — flujos reproducibles (preflight, intake de prototipos, implementacion de pantalla/flujo, migraciones, contrato API, pruebas, accesibilidad, trazabilidad, deteccion de conflictos).
- `.claude/rules/shared|frontend|backend/` — reglas detalladas por alcance de ruta (evita repetir aqui lo que ya vive en agentes/skills).
- `.claude/hooks/` + `.claude/settings.json` — validaciones automaticas de bajo costo sobre archivos afectados.

No dupliques en agentes o skills lo que ya dice una regla; referenciala.

---

## 3. Jerarquía de autoridad

Cada fuente gobierna un aspecto diferente:

1. BDD gobierna comportamiento observable, escenarios y reglas de negocio.
2. SDD gobierna procesos, diseño funcional y responsabilidades.
3. TDD gobierna arquitectura, persistencia, integración y decisiones técnicas.
4. OpenAPI gobierna el contrato entre frontend y backend.
5. UX/UI gobierna navegación, interacción, contenido y estados de interfaz.
6. El prototipo JPG/PNG aprobado gobierna composición y apariencia visual.
7. El Design System gobierna componentes, tokens y comportamiento visual.
8. El código existente representa el estado implementado, no reemplaza las
   fuentes aprobadas.

Una imagen nunca constituye autoridad para inferir:

- reglas de negocio;
- permisos;
- validaciones;
- estados de dominio;
- contratos de API;
- persistencia;
- transiciones no documentadas.

---

## 4. Política de contradicciones

No resolver contradicciones importantes mediante suposición.

Si dos fuentes se contradicen:

1. Identificar las fuentes y versiones involucradas.
2. Describir la contradicción.
3. Determinar qué parte del trabajo está afectada.
4. Registrar el hallazgo en `docs/conflicts/`.
5. Detener solamente el alcance afectado.
6. Solicitar una decisión concreta.

Códigos de detención:

- `MISSING_SOURCE`: falta una fuente obligatoria.
- `STALE_SOURCE`: una fuente está desactualizada.
- `SOURCE_CONFLICT`: dos fuentes autorizadas se contradicen.
- `MISSING_VISUAL_BASELINE`: no existe prototipo aprobado.
- `STALE_VISUAL_BASELINE`: el prototipo no corresponde a la versión UX/UI.
- `UNAPPROVED_DEVIATION`: se requiere apartarse de una fuente aprobada.
- `MISSING_API_CONTRACT`: falta el contrato OpenAPI necesario.
- `SECURITY_RISK`: la acción podría vulnerar seguridad o aislamiento.
- `DESTRUCTIVE_OPERATION`: la acción puede causar pérdida irreversible.

---

## 5. Trazabilidad obligatoria

Toda implementación debe poder relacionarse con:

BDD → SDD → TDD → UX-ID → PROTO-ID → OpenAPI → código → pruebas → evidencia.

Antes de implementar:

- identificar los IDs aplicables;
- consultar `docs/source-manifest.yaml`;
- consultar `docs/prototype-manifest.yaml` para interfaces;
- verificar el estado y versión de las fuentes;
- registrar cualquier fuente ausente.

Después de implementar:

- actualizar la trazabilidad;
- registrar pruebas ejecutadas;
- guardar evidencias relevantes;
- indicar las diferencias aprobadas;
- informar riesgos o pendientes.

No declarar una funcionalidad terminada sin trazabilidad verificable.

---

## 6. Arquitectura frontend obligatoria

El frontend debe utilizar:

- React SPA/PWA.
- TypeScript.
- Vite.
- React Router.
- TanStack Query para estado remoto.
- Zustand exclusivamente para estado cliente global.
- React Hook Form para formularios.
- Zod para validación.
- Cliente generado desde OpenAPI.
- Radix UI para primitivas accesibles.
- CSS Modules.
- Lucide para iconografía.
- date-fns para fechas.
- TanStack Table para tablas complejas.
- Vitest.
- Testing Library.
- MSW.
- Playwright.
- axe.
- Sentry.

Workbox y Dexie se utilizarán solamente en los casos offline aprobados:

- `ALQ-09`.
- `DEV-04`.

Está prohibido introducir Next.js.

No agregar otro framework de routing, formularios, validación, estado remoto,
estado global o componentes visuales sin una decisión arquitectónica aprobada.

---

## 7. Arquitectura backend obligatoria

El backend debe utilizar:

- Node.js 22.
- TypeScript.
- NestJS.
- Prisma.
- PostgreSQL.
- Firebase Authentication.
- OpenAPI versionado.
- Cloud Tasks cuando el procesamiento asíncrono esté aprobado.

Las migraciones deben ser:

- revisables;
- reproducibles;
- compatibles con el modelo Prisma;
- seguras para datos existentes;
- reversibles cuando sea técnicamente viable.

No ejecutar migraciones contra producción automáticamente.

---

## 8. Multiempresa y seguridad

La solución debe respetar el aislamiento de las empresas del Grupo KAIROS.

Toda operación aplicable debe considerar:

- tenant o grupo;
- empresa;
- sede;
- usuario;
- rol;
- permisos;
- ownership del recurso.

Nunca confiar únicamente en restricciones del frontend.

El backend debe validar autorización y aislamiento de datos.

No registrar en logs:

- contraseñas;
- tokens;
- secretos;
- documentos completos;
- datos biométricos;
- información personal sensible innecesaria.

No crear bypasses temporales de autenticación o autorización.

---

## 9. Implementación de pantallas

Toda pantalla requiere:

- `UX-ID`;
- especificación UX/UI localizable;
- referencias BDD, SDD y TDD aplicables;
- contrato OpenAPI cuando consuma servicios;
- al menos un JPG/PNG con estado `APPROVED`;
- `PROTO-ID` registrado en `docs/prototype-manifest.yaml`.

El prototipo aprobado controla:

- layout;
- orden de secciones;
- jerarquía visual;
- contenido visible;
- posición relativa;
- componente representado;
- CTA primario;
- lenguaje visual.

La especificación UX/UI y el Design System completan los estados no visibles:

- loading;
- vacío;
- error;
- validación;
- guardado;
- confirmación;
- permisos insuficientes;
- sesión vencida;
- offline, cuando corresponda;
- responsive;
- teclado;
- lector de pantalla.

Detenerse con `MISSING_VISUAL_BASELINE` si no existe una referencia aprobada.

---

## 10. Criterios de validación visual

La comparación visual debe revisar:

- estructura;
- jerarquía;
- orden de las secciones;
- componentes;
- tokens;
- tipografía;
- espaciado;
- tamaños relativos;
- CTA principal;
- responsive;
- estados interactivos;
- accesibilidad;
- elementos no autorizados.

Una diferencia automática de píxeles de `≤ 2%` es orientativa, no suficiente
por sí sola.

Se requiere:

- cero diferencias críticas de estructura;
- cero diferencias críticas de jerarquía;
- cero componentes externos al Design System sin justificación;
- cero reglas inferidas exclusivamente desde la imagen;
- aprobación humana de diferencias intencionales.

La accesibilidad y la semántica prevalecen sobre la coincidencia ciega de
píxeles.

---

## 11. Experiencia de usuario

Los flujos deben ser simples, directos y evitar pasos innecesarios.

Antes de agregar una interacción:

- comprobar que resuelve una regla documentada;
- evitar confirmaciones redundantes;
- evitar modales encadenados;
- evitar navegación innecesaria;
- conservar el contexto del usuario;
- mostrar feedback inmediato;
- mantener visible el siguiente paso;
- reutilizar datos ya ingresados;
- no pedir nuevamente información disponible.

No simplificar un flujo si la simplificación elimina controles legales, de
seguridad o de negocio.

---

## 12. Reutilización y Design System

Antes de crear un componente:

1. Buscar componentes existentes.
2. Consultar el Design System.
3. Evaluar composición de primitivas existentes.
4. Crear un componente nuevo solamente si existe una necesidad no cubierta.

No duplicar:

- botones;
- campos;
- tablas;
- modales;
- alerts;
- layouts;
- validadores;
- clientes HTTP;
- modelos de dominio.

Los componentes compartidos no deben contener reglas específicas de un módulo.

---

## 13. OpenAPI y comunicación frontend-backend

El frontend debe consumir el cliente generado desde OpenAPI.

Está prohibido:

- construir manualmente clientes duplicados;
- inventar endpoints;
- inventar DTO;
- usar `any` para ocultar incompatibilidades;
- modificar el contrato solo para hacer pasar el frontend;
- acoplar componentes visuales directamente al transporte HTTP.

Si el contrato requerido no existe, detenerse con `MISSING_API_CONTRACT`.

Los cambios de contrato deben coordinar:

- especificación OpenAPI;
- DTO backend;
- validación;
- cliente generado;
- mocks;
- pruebas;
- trazabilidad.

---

## 14. Pruebas proporcionales al cambio

Ejecutar solamente las pruebas necesarias para el alcance modificado.

Orden recomendado:

1. Validación estática.
2. Typecheck selectivo.
3. Pruebas unitarias relacionadas.
4. Pruebas de componente o integración relacionadas.
5. Prueba E2E del flujo afectado.
6. Accesibilidad y visual regression cuando exista interfaz.

No ejecutar toda la suite después de cada edición.

La validación rápida del framework debe terminar idealmente en menos de
2 minutos.

Las suites completas deben reservarse para gates de integración o release.

No declarar que una prueba pasó si no fue ejecutada.

---

---

## 14.1 Comandos de verificación rápidos

Objetivo: terminar en menos de 2 minutos. No sustituyen los gates de integración/release.

```bash
# Sintaxis y referencias del propio framework (bajo costo, siempre disponible)
bash .claude/hooks/check-claude-syntax.sh <archivos .claude/** afectados>
bash .claude/hooks/check-missing-references.sh <archivos afectados>
bash .claude/hooks/check-screen-without-baseline.sh <archivos apps/web/src/features/** afectados>
bash .claude/hooks/check-no-secrets.sh <archivos afectados>

# Cuando exista código en apps/web o apps/api (aún no existe en este repo):
# - lint/typecheck selectivo del paquete afectado
# - pruebas unitarias/componente relacionadas al alcance modificado
# - claude /doctor, si está disponible en el entorno
```

No ejecutar la suite completa ni build completo en cada edición; eso se reserva para gates de integración/release (ver `.claude/rules/shared/agent-output-format.md` y los agentes `release-gatekeeper`/`qa-gatekeeper`).

---

## 15. Operaciones prohibidas sin autorización

No realizar automáticamente:

- `git push`;
- merge;
- creación o publicación de pull requests;
- deployment;
- migraciones de producción;
- eliminación masiva;
- restauración destructiva;
- rotación de credenciales;
- cambios de infraestructura;
- instalaciones o upgrades de dependencias;
- cambios de versiones del stack;
- escritura en servicios externos.

No usar comandos destructivos como:

- `git reset --hard`;
- eliminación recursiva de directorios amplios;
- limpieza irreversible de bases de datos;
- sobrescritura de secretos.

Solicitar autorización cuando la tarea requiera ampliar el alcance.

---

## 16. Forma de trabajo

Para cada tarea:

1. Entender el objetivo.
2. Inspeccionar el código relacionado.
3. Resolver las fuentes documentales.
4. Identificar trazabilidad.
5. Detectar conflictos.
6. Proponer un plan breve.
7. Implementar el cambio mínimo coherente.
8. Validar el alcance afectado.
9. Actualizar trazabilidad y evidencias.
10. Informar resultado, pruebas y pendientes.

Preservar cambios existentes que no pertenezcan a la tarea.

No refactorizar áreas no relacionadas sin autorización.

---

## 17. Definición de terminado

Una tarea está terminada solamente cuando:

- cumple las fuentes aplicables;
- respeta la arquitectura aprobada;
- no contiene reglas inventadas;
- conserva aislamiento multiempresa;
- tiene contrato API válido cuando corresponde;
- posee estados de interfaz necesarios;
- cumple accesibilidad aplicable;
- pasa las verificaciones proporcionales;
- actualiza trazabilidad;
- registra evidencia;
- no deja contradicciones críticas ocultas;
- documenta riesgos pendientes.

Si algún criterio no se cumple, reportar el trabajo como parcial o bloqueado,
no como completado.