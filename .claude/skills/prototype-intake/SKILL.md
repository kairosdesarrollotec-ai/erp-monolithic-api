---
name: prototype-intake
description: "Registra o versiona un JPG/PNG (incluye exports Stitch code.html+screen.png) como PROTO-ID en prototype-manifest.yaml. Nunca autoaprueba."
---

## Proposito
Convertir un archivo visual nuevo (o reemplazo) en un `PROTO-ID` trazable, con hash, version, estado y viewport, sin asumir aprobacion.

## Cuando usarla
Al incorporar un prototipo nuevo (ej. un export adicional de Stitch/Figma) o al reemplazar uno existente por una version mas reciente.

## Parametros de entrada
`ux_id`, ruta de la imagen (y del `code.html` cuando provenga de Stitch), `screen_state`, `viewport`, `version`, `theme`, `locale`, `timezone`, `supersedes` (opcional).

## Fuentes obligatorias
`docs/prototype-manifest.yaml`, especificacion UX/UI v3.1 (para resolver el `UX-ID` correcto en la seccion 5 "Inventario detallado de pantallas").

## Precondiciones
El `UX-ID` debe existir en la especificacion UX/UI. Si no hay `UX-ID` claro (p. ej. un elemento del shell global sin entrada propia en el inventario), se registra con `ux_id: null` y `status: PENDING_TRACE_REVIEW`, nunca se inventa un ID.

## Secuencia de ejecucion
1. Validar formato, resolucion y ausencia de PII visible en la imagen.
2. Calcular `sha256` del archivo.
3. Generar `PROTO-ID` determinista: `PROTO-<UX-ID>-<descripcion-corta>`.
4. Si reemplaza un `PROTO-ID` previo, enlazar `supersedes` y marcar el anterior como `SUPERSEDED`.
5. Escribir/actualizar la entrada en `docs/prototype-manifest.yaml` (via agente `index-maintainer` o directamente si la skill corre con permisos de escritura).
6. Estado inicial: `DRAFT` o `PENDING_REVIEW`. Nunca `APPROVED` sin evidencia explicita de aprobacion (aprobador + fecha) provista por quien invoca la skill.

## Condiciones STOP
Imagen sin `UX-ID` resoluble y sin autorizacion para registrar como `PENDING_TRACE_REVIEW`; hash no calculable; formato no soportado.

## Artefactos de salida
Entrada nueva/actualizada en `docs/prototype-manifest.yaml`.

## Validaciones
`PROTO-ID` unico; `supersedes` no crea ciclos; `sha256` no duplica uno ya `APPROVED` bajo un ID distinto (evita duplicados accidentales).

## Criterios de aceptacion
El manifiesto queda consistente y el historial de reemplazos es navegable.

## Ejemplo minimo de invocacion
`prototype-intake(ux_id="ALQ-09", image="docs/prototypes/approved/.../screen.png", screen_state="SYNCED", viewport="mobile")`
