# BDD — 11 Búsqueda Global

# BDD-BUS-001 — Feature: Búsqueda Global

**Código:** BDD-KAIROS-MVP-BUS-001 **Versión:** 1.0 (creado 11-oct-2026 — base usable inicial) **Depende de:** `BDD-KAIROS-TRANSVERSAL.md`

> La búsqueda global es un componente transversal del shell de la aplicación. No es un módulo de dominio independiente: es una capa de acceso rápido que permite al usuario encontrar cualquier entidad del sistema sin necesidad de navegar a cada módulo.

---

## 1. Contexto y alcance

La búsqueda global permite localizar en tiempo real:

- **Alquileres** — por código ALQ, nombre del cliente o placa del vehículo.
- **Reservas** — por código RES, nombre del cliente o placa.
- **Clientes** — por nombre, DNI/RUC o correo.
- **Vehículos** — por placa, marca, modelo.
- **Devoluciones** — por código DEV.

Los resultados se agrupan por tipo de entidad. Solo se muestran entidades a las que el actor tiene acceso según sus permisos y empresa.

---

## 2. Comportamiento observable

| Paso | Actor | Acción | Resultado |
| --- | --- | --- | --- |
| BUS-P01 | Cualquier usuario autenticado | Activa el buscador (ícono lupa en topbar) | Se abre el dropdown de búsqueda |
| BUS-P02 | Usuario | Escribe 2+ caracteres | El sistema consulta en tiempo real (debounce 300 ms) |
| BUS-P03 | Sistema | Ejecuta búsqueda | Devuelve hasta 5 resultados por grupo (máx. 3 grupos visibles) |
| BUS-P04 | Usuario | Selecciona un resultado | Navega al detalle de la entidad seleccionada |
| BUS-P05 | Sistema | Sin resultados | Muestra estado vacío con mensaje orientador |
| BUS-P06 | Usuario | Presiona Escape o hace clic fuera | Se cierra el dropdown |

---

## 3. Reglas de negocio

| ID | Regla | Prioridad | Estado |
| --- | --- | --- | --- |
| BR-BUS-001 | La búsqueda requiere mínimo 2 caracteres para ejecutarse | Media | `CONFIRMADO` |
| BR-BUS-002 | Los resultados filtran por `companyId` y `branchId` del actor autenticado — nunca se muestran entidades de otra empresa | Crítica | `CONFIRMADO` |
| BR-BUS-003 | Solo se muestran entidades a las que el actor tiene permiso de `READ_LIST` o `READ_DETAIL` en su módulo correspondiente | Alta | `CONFIRMADO` |
| BR-BUS-004 | El debounce es de 300 ms para no saturar la API con cada pulsación | Media | `CONFIRMADO` |
| BR-BUS-005 | Máximo 5 resultados por grupo de entidad; máximo 3 grupos en el dropdown | Media | `CONFIRMADO` |
| BR-BUS-006 | Al seleccionar un resultado, el usuario navega a la pantalla de detalle del módulo correspondiente | Alta | `CONFIRMADO` |
| BR-BUS-007 | La búsqueda es de solo lectura — no modifica ningún estado del sistema | Crítica | `CONFIRMADO` |
| BR-BUS-008 | La búsqueda global no indexa datos biométricos, contraseñas ni documentos completos | Crítica | SDD-KAIROS-TRANSVERSAL.md §privacidad | `CONFIRMADO` |

---

## 4. Datos indexados

| Entidad | Campos buscables | Permiso requerido |
| --- | --- | --- |
| Alquiler | código ALQ, nombre del cliente, placa | `RENTAL.READ_LIST` |
| Reserva | código RES, nombre del cliente, placa | `RESERVATION.READ_LIST` |
| Cliente | nombre, DNI/RUC, correo | `CUSTOMER.READ_LIST` |
| Vehículo | placa, marca, modelo | `FLEET.READ_LIST` |
| Devolución | código DEV, nombre del cliente | `RETURN.READ` |

---

## 5. Escenarios Gherkin

```gherkin
Feature: Búsqueda global en tiempo real
  Scenario: Usuario encuentra un alquiler por código
    Given el usuario está autenticado con permiso RENTAL.READ_LIST
    When escribe "ALQ-1203" en el buscador global
    Then el sistema devuelve el alquiler ALQ-1203 en el grupo "Alquileres"
    And muestra el nombre del cliente y la placa del vehículo

  Scenario: Menos de 2 caracteres no dispara búsqueda
    Given el usuario está en cualquier pantalla
    When escribe "A" en el buscador global
    Then no se ejecuta ninguna consulta al backend
    And el dropdown muestra el estado inicial

  Scenario: Sin resultados
    Given el usuario busca "XYZ999"
    When no hay entidades que coincidan
    Then el sistema muestra el estado vacío con sugerencia de revisar el término

  Scenario: Aislamiento multiempresa
    Given el usuario pertenece a empresa A
    And existe un alquiler "ALQ-0001" en empresa B
    When el usuario busca "ALQ-0001"
    Then el resultado NO aparece en el dropdown
```

---

## 6. Preguntas abiertas

| ID | Pregunta | Estado |
| --- | --- | --- |
| OQ-BUS-001 | ¿La búsqueda usa un índice de texto en PostgreSQL (pg_trgm/full-text) o una búsqueda exacta/LIKE? | `ABIERTA` — resolver en TDD antes de implementar backend |
| OQ-BUS-002 | ¿Se busca en Reclutamiento (candidatos, vacantes) o solo en módulos operativos? | `ABIERTA` — definir alcance con producto |
