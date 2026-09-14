---
description: Reglas de contrato OpenAPI y comunicacion frontend-backend.
paths: ['apps/api/**', 'apps/web/**']
---

# OpenAPI y comunicacion frontend-backend

El frontend consume el cliente generado desde OpenAPI. Prohibido: construir manualmente clientes duplicados, inventar endpoints o DTO, usar `any` para ocultar incompatibilidades, modificar el contrato solo para hacer pasar el frontend, acoplar componentes visuales directamente al transporte HTTP.

Si el contrato requerido no existe: STOP `MISSING_API_CONTRACT`. Los cambios de contrato coordinan: especificacion OpenAPI, DTO backend, validacion, cliente generado, mocks, pruebas y trazabilidad.
