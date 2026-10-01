# Trazabilidad — Documentación BDD/SDD/TDD Clientes (Backend)

**Fecha:** 2026-10-01  
**Módulo:** Customers  
**Rama:** `feature/flota-clientes-admin-disponible`

---

## 1. Cadena de trazabilidad

| Eslabón | Referencia | Estado |
|---------|-----------|--------|
| **BDD** | `docs/sources/bdd/bdd-clients.md` v1.0 (BR-CLI-001..005, SC-CLI-001..005) | approved |
| **SDD** | `docs/sources/sdd/sdd-clients.md` v1.0 | approved |
| **TDD** | `docs/sources/tdd/tdd-clients.md` v1.0 (TDD-CLI-ADR-001..003) | approved |
| **OpenAPI** | `packages/contracts/openapi/customers.yaml` v0.1.0 | Contrato vigente |
| **Código** | `modules/customers/` (ya implementado en main) | Implementado |
| **Pruebas** | Tests existentes del módulo customers | Passing |
| **Evidencia** | Pendiente de registro formal | — |

---

## 2. Alcance de este cambio

Este cambio agrega documentación BDD/SDD/TDD específica para el módulo customers,
cerrando BRECHA-CLI-01 (falta de fuentes documentales específicas del módulo).

Los documentos formalizan las reglas de negocio, diseño funcional y arquitectura
técnica del módulo que ya estaba implementado en main. No se modifica código
del módulo customers en este PR.

---

## 3. Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `docs/sources/bdd/bdd-clients.md` | BDD: reglas BR-CLI-001..005, escenarios SC-CLI-001..005 |
| `docs/sources/sdd/sdd-clients.md` | SDD: componentes, políticas de rol, flujo coincidencia DNI |
| `docs/sources/tdd/tdd-clients.md` | TDD: modelo Prisma, contrato, aislamiento, ADRs |
