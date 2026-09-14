---
name: accessibility
description: "Ejecuta y documenta validacion WCAG 2.2 AA (axe + revision manual de foco/teclado/lector de pantalla) sobre una pantalla o componente."
---

## Proposito
Priorizar accesibilidad y semantica sobre coincidencia ciega de pixeles con el prototipo.

## Cuando usarla
Tras implementar una pantalla, o al revisar un componente del Design System.

## Parametros de entrada
Ruta de la pantalla/componente, `ux_id` relacionado (opcional).

## Fuentes obligatorias
Especificacion UX/UI seccion 10 (Accesibilidad WCAG 2.2 AA).

## Precondiciones
La pantalla/componente es navegable en el entorno de pruebas.

## Secuencia de ejecucion
1. Ejecutar axe sobre la pantalla/componente.
2. Revisar manualmente: contraste, foco visible, orden de tabulacion, semantica de landmarks/roles, tamano tactil minimo, textos alternativos.
3. Si el prototipo aprobado tiene un defecto (p. ej. contraste insuficiente), documentar la correccion como desviacion visual justificada, no modificar el `PROTO-ID`.
4. Registrar hallazgos con severidad.

## Condiciones STOP
Cualquier hallazgo critico (bloqueante para uso con teclado o lector de pantalla) abierto.

## Artefactos de salida
Reporte de accesibilidad (insumo de `artifacts/evidence/`).

## Validaciones
Cero criticos abiertos.

## Criterios de aceptacion
La pantalla cumple WCAG 2.2 AA aplicable; desviaciones frente al prototipo estan documentadas y aprobadas.

## Ejemplo minimo de invocacion
`accessibility(target="apps/web/src/features/reserva/bandeja")`
