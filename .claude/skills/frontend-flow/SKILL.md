---
name: frontend-flow
description: "Orquesta la implementacion de un flujo multi-pantalla (varias UX-ID encadenadas) preservando contexto, navegacion y datos ya ingresados entre pasos."
---

## Proposito
Evitar que cada pantalla de un flujo (p. ej. Alquiler CON-04->ALQ-02->...->ALQ-10) se implemente de forma aislada perdiendo contexto o duplicando logica de navegacion.

## Cuando usarla
Cuando el alcance de la tarea cubre un flujo documentado en la especificacion UX/UI (seccion "Flujo <modulo>") en vez de una unica pantalla.

## Parametros de entrada
`task_id`, lista ordenada de `ux_id` del flujo, o el nombre del flujo documentado (p. ej. "Flujo Alquiler").

## Fuentes obligatorias
Seccion "Flujo <modulo>" de la especificacion UX/UI v3.1, `prototype-manifest.yaml`, BDD/SDD/TDD del modulo.

## Precondiciones
Cada `ux_id` del flujo debe pasar individualmente el preflight de `frontend-screen` (o ya estar implementado).

## Secuencia de ejecucion
1. Resolver la secuencia oficial de UX-ID del flujo desde la especificacion UX/UI.
2. Para cada UX-ID sin implementar, invocar `frontend-screen`.
3. Verificar que la navegacion entre pasos reutilice datos ya ingresados (no repreguntar informacion disponible).
4. Verificar rutas de excepcion documentadas (p. ej. conflicto, venta, cambio, no-show en Reserva) y que esten cubiertas o explicitamente fuera de alcance.
5. Actualizar trazabilidad del flujo completo.

## Condiciones STOP
Un paso del flujo no tiene baseline `APPROVED`; una ruta de excepcion documentada no esta cubierta ni declarada fuera de alcance.

## Artefactos de salida
Conjunto de pantallas implementadas + entrada de trazabilidad de flujo en `artifacts/traceability/`.

## Validaciones
El flujo implementado coincide con la secuencia y las excepciones documentadas en UX/UI.

## Criterios de aceptacion
Un usuario puede completar el flujo documentado sin pasos faltantes ni perdida de contexto entre pantallas.

## Ejemplo minimo de invocacion
`frontend-flow(task_id="KAI-ALQ-FLOW-01", flow="Flujo Alquiler")`
