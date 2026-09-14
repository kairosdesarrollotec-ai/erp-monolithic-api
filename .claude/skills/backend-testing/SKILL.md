---
name: backend-testing
description: "Genera pruebas unitarias, de integracion, contrato y concurrencia para un slice backend, incluyendo aislamiento multiempresa."
---

## Proposito
Cubrir invariantes de dominio, constraints de base de datos y contrato, con enfasis en pruebas negativas de aislamiento multiempresa.

## Cuando usarla
Tras implementar un slice backend (`backend-feature`, `backend-migration` y/o `backend-api`).

## Parametros de entrada
Modulo, invariantes a probar, endpoints/comandos afectados.

## Fuentes obligatorias
TDD del modulo (invariantes y constraints documentados).

## Precondiciones
El slice compila y las migraciones (si las hay) ya se aplicaron en el entorno de pruebas.

## Secuencia de ejecucion
1. Pruebas unitarias de dominio (invariantes, comandos).
2. Pruebas de integracion contra base de datos real de pruebas (constraints, RLS).
3. Pruebas de contrato contra la especificacion OpenAPI.
4. Pruebas de concurrencia para invariantes criticas (no solapamiento, idempotencia).
5. Pruebas negativas de aislamiento multiempresa (usuario de empresa A no accede a datos de empresa B).
6. Ejecutar solo las pruebas del alcance modificado.

## Condiciones STOP
Invariante critica sin prueba; prueba de aislamiento multiempresa ausente.

## Artefactos de salida
Archivos de test + reporte de ejecucion real.

## Validaciones
No declarar una prueba como pasada sin ejecutarla.

## Criterios de aceptacion
Cobertura de invariantes criticas >=90%, pruebas de aislamiento presentes y en verde.

## Ejemplo minimo de invocacion
`backend-testing(module="rentals", invariants=["no-solapamiento-por-vehiculo"])`
