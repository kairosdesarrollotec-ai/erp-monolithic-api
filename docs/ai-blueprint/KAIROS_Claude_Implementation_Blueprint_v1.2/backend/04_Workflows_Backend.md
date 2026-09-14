# Workflows Claude — Backend, Migraciones y API

## WF-BE-01 Vertical slice contract-first

1. Seleccionar una fila de trazabilidad BDD→SDD→TDD.
2. Ejecutar preflight y resolver dependencias.
3. Diseñar dominio/comando y errores.
4. Crear/ajustar migración y constraints.
5. Definir OpenAPI/eventos.
6. Generar tipos y stubs.
7. Implementar caso de uso, puertos y adaptadores.
8. Añadir auditoría/outbox/idempotencia.
9. Ejecutar pruebas y gates.
10. Actualizar trazabilidad y evidencia.

Prohibido iniciar por el controller o por una tabla inventada.

## WF-BE-02 Migración segura

- Clasificar: additive, backfill, constraint, destructive o data migration.
- Preferir expand → backfill → validate → contract.
- Medir lock y volumen; usar índices concurrentes cuando aplique.
- Probar upgrade desde versión anterior y arranque de aplicación N/N-1.
- Destructive requiere backup verificado, plan de recuperación y aprobación de Datos.
- Rollback de aplicación no implica revertir datos; usar forward-fix/reconciliación.

## WF-BE-03 Cambio de API

- Actualizar OpenAPI primero.
- Detectar breaking change con diff.
- Validar autorización, idempotencia, errores y ejemplos.
- Regenerar cliente/tipos.
- Contract test proveedor/consumidor.
- Breaking change: nueva versión o estrategia de compatibilidad aprobada.

## WF-BE-04 Concurrencia de vehículo

- Crear el compromiso únicamente al confirmar requisitos completos.
- Ejecutar transacción y constraint de rango/solapamiento.
- Mapear conflicto a error de negocio estable.
- Probar dos confirmaciones simultáneas: exactamente una gana.
- No implementar bloqueo provisional, cola en memoria ni check-then-insert sin constraint.

## WF-BE-05 Outbox y Cloud Tasks

- Guardar agregado + evento en una transacción.
- Publicador reclama eventos con concurrencia segura.
- Crear tarea con identificador deduplicable.
- Consumidor idempotente y observable.
- Retry exponencial, dead-letter/replay y alertas.
- Pruebas: caída antes/después de commit, entrega duplicada y dependencia caída.

## WF-BE-06 Seguridad multiempresa

- Enumerar endpoint/repository/query afectados.
- Validar tenant derivado de sesión.
- Aplicar scope y RLS.
- Probar misma empresa autorizada, otra empresa denegada, rol insuficiente, sede distinta, asignación vencida y enumeración por ID.

## WF-BE-07 Release de módulo

- G0–G7 comunes.
- Migraciones verificadas con snapshot anonimizado.
- OpenAPI compatible y publicado.
- Tests críticos y resiliencia completos.
- SAST/SCA/secrets/SBOM sin hallazgo bloqueante.
- Runbooks y dashboards disponibles.
- Aprobación UAT de Fiorella por módulo registrada.

## Orden de slices

1. Organización, IAM y roles.
2. Flota, tarifas y disponibilidad.
3. Clientes, Consulta y cotización.
4. Reserva y concurrencia.
5. Alquiler y validaciones.
6. Contrato, pago y notaría.
7. Evidencia y offline de entrega.
8. Alquiler activo y ampliación.
9. Devolución y recepción.
10. Daños, garantía y cierre.
11. Reclutamiento.
12. Administración de Personal.
13. Reportes, notificaciones y auditoría.
