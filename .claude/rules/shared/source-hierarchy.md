---
description: Jerarquia de autoridad documental y no invencion. Aplica a todo el repositorio.
paths: ['**']
---

# Jerarquia de fuentes

1. Decision explicita aprobada en `docs/decision-log.md` (no puede inventarse retroactivamente).
2. BDD del proceso mas reciente: comportamiento, reglas de negocio.
3. SDD del proceso mas reciente + SDD Transversal: componentes, procesos, diseno funcional.
4. TDD del proceso mas reciente + TDD Transversal: arquitectura, persistencia, integracion.
5. OpenAPI / JSON Schema / migraciones / ADR aprobados: contrato ejecutable.
6a. UX/UI v3.1: navegacion, interaccion, estados, responsive, accesibilidad.
6b. JPG/PNG `APPROVED` en `docs/prototype-manifest.yaml`: autoridad visual solo para el `UX-ID`, estado y viewport declarados. No redefine negocio, contratos ni stack.
7. Codigo y pruebas existentes: implementacion, no requisito. Un defecto existente no se convierte en regla.

Una imagen nunca constituye autoridad para inferir: reglas de negocio, permisos, validaciones, estados de dominio, contratos de API, persistencia o transiciones no documentadas.

Cuando dos fuentes del mismo nivel discrepen, prevalece la version mas reciente solo si el historial documental registra explicitamente el cambio. En otro caso: STOP `SOURCE_CONFLICT` y registrar en `docs/conflicts/`.
