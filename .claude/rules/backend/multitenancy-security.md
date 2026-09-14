---
description: Aislamiento multiempresa y reglas de seguridad obligatorias. Aplica a apps/api/**.
paths: ['apps/api/**']
---

# Multiempresa y seguridad (apps/api/**)

Toda operacion aplicable debe considerar: tenant/grupo, empresa, sede, usuario, rol, permisos, ownership del recurso. Nunca confiar unicamente en restricciones del frontend; el backend valida autorizacion y aislamiento de datos.

No registrar en logs: contrasenas, tokens, secretos, documentos completos, datos biometricos, informacion personal sensible innecesaria. No crear bypasses temporales de autenticacion o autorizacion.
