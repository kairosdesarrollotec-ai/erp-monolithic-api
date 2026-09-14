# Reglas Claude — Backend, API y migraciones

## Stack cerrado

- Node.js 22 LTS, TypeScript 5.9.x y NestJS.
- Monolito modular con Clean Architecture.
- PostgreSQL administrado por Supabase, región `sa-east-1`.
- Prisma ORM 7.10.0; `prisma`, `@prisma/client` y `@prisma/adapter-pg` con la misma versión.
- Firebase Authentication con Identity Platform; MFA TOTP obligatorio.
- Cloud Tasks + outbox transaccional.
- Google Cloud Storage privado con carga directa mediante URL temporal.
- Google Cloud Run, Secret Manager, Logging y Sentry.
- OpenAPI 3.1 contract-first.

Una dependencia nueva requiere ADR y aprobación; no se sustituye tecnología por preferencia del agente.

## Arquitectura

- `domain` no importa NestJS, Prisma, Firebase, HTTP ni SDK cloud.
- `application` depende de dominio y puertos.
- `presentation` adapta HTTP a casos de uso.
- `infrastructure` implementa puertos.
- Un módulo nunca lee/escribe tablas internas de otro módulo.
- Comunicación síncrona por puerto explícito; asíncrona por evento versionado.
- No crear microservicios en el MVP.

## Datos y multiempresa

- `company_id` obligatorio en toda entidad empresarial; maestros globales solo donde el TDD lo autorice.
- Tenant se deriva de claims/contexto, nunca del body confiado.
- Autorización en aplicación más RLS/constraint complementario.
- Toda consulta está scoped; toda prueba de repositorio incluye caso cruzado negativo.
- UUID, timestamps UTC y presentación en `America/Lima`.
- Dinero en tipo exacto/decimal y moneda explícita; nunca `float`.
- Soft delete solo si TDD lo define; auditoría no se borra ni edita.

## Migraciones

- Forward-only, transaccionales cuando PostgreSQL lo permita y con nombre estable.
- No modificar migración aplicada; no resetear bases compartidas.
- Analizar locks, duración, backfill, nulabilidad, índice concurrente y compatibilidad N/N-1.
- Constraints críticos en DB además de dominio: no solapamiento de compromisos, versión contractual activa única, vacaciones no superpuestas, cascada ≤3 y riesgo solo-avance.
- Seed idempotente, mínimo y sin PII real.
- `pg_dump` cifrado + backup gestionado; recovery probado según RPO 15 min/RTO 2 h.

## API

- Comandos explícitos (`/commands/confirm`, `/commands/cancel`, etc.); prohibido `PATCH status`.
- `Idempotency-Key` obligatorio en escrituras críticas.
- Concurrency control con constraint/versión y error de dominio estable.
- Errores `application/problem+json` o envelope único aprobado; sin stack/PII.
- Paginación por cursor para listas con crecimiento; filtros allowlist.
- OpenAPI es fuente de clientes/tipos, no reflejo tardío del controlador.
- Ningún binario grande atraviesa la API.

## Seguridad

- Denegación por defecto; verificar autenticación, asignación, rol, empresa, sede y MFA reciente ≤5 min en operaciones críticas.
- Validar input en borde y regla en dominio; output mínimo.
- Secretos solo en Secret Manager/variables seguras; nunca repositorio, log o fixture.
- Logs estructurados con correlation ID, sin DNI completo, token, contrato, foto o datos financieros.
- SAST, SCA, secret scanning, IaC scanning, DAST y SBOM en pipeline.

## Reglas de negocio P0 que ningún agente puede alterar

- No existe ni existirá `VehicleHold`.
- Reserva incompleta es borrador/no confirmada y no bloquea vehículo.
- Reserva/Alquiler confirman compromiso de vehículo con consistencia fuerte.
- No-show requiere protocolo y decisión humana; no expira automáticamente.
- Offline solo captura borradores de los checklists de entrega/devolución; nunca confirma.
- MTC caído bloquea; RENIEC caído permite excepción autorizada.
- Alcolímetro desfavorable de entrega bloquea/cancela y no marca Rojo automáticamente.
- Alcolímetro desfavorable en devolución deja custodia/derivación según BR-DEV-005.
- Daño técnico usa informe externo Motrix; no calcular precio técnico internamente.
- Riesgo/Cliente Rojo no retrocede según BR-DEV-008.
- Cascada ADP: Fiorella → José → Cecilia, 5 min por nivel y sin cuarto nivel automático.

## Calidad

- Cero `any` injustificado y cero catch vacío.
- Tests deterministas; no dependen de red productiva.
- Cobertura no reemplaza escenarios: 100% críticos, ≥90% dominio crítico, ≥80% nuevo.
- Cada handler tiene pruebas de autorización, validación, idempotencia y auditoría aplicables.
