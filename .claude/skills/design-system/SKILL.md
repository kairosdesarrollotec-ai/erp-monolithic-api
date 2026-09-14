---
name: design-system
description: "Mapea un prototipo aprobado o DESIGN.md a componentes, variantes y tokens del Design System (Radix + CSS Modules), documentandolos."
---

## Proposito
Evitar tokens o componentes arbitrarios: todo valor visual debe salir de una fuente (`DESIGN.md` o UX/UI seccion 9), nunca de "lo que se ve bien" en la imagen.

## Cuando usarla
Al crear o modificar un componente compartido, o cuando `frontend-screen` detecta un patron visual no cubierto por el Design System actual.

## Parametros de entrada
Referencia al prototipo o zona de UI a mapear, `ux_id` relacionado (opcional).

## Fuentes obligatorias
`docs/prototypes/approved/stitch_veloxrent_prototipo_b/veloxrent_erp_design_system/DESIGN.md`, especificacion UX/UI v3.1 seccion 9 (Sistema de diseno y componentes).

## Precondiciones
Se confirmo que no existe ya un componente equivalente (busqueda previa obligatoria).

## Secuencia de ejecucion
1. Buscar componentes existentes en el Design System actual.
2. Consultar `DESIGN.md` y la seccion 9 de UX/UI.
3. Evaluar si el patron se resuelve componiendo primitivas existentes (Radix) antes de crear algo nuevo.
4. Si se requiere un componente nuevo: documentar anatomia, estados, variantes y tokens usados, con referencia a la fuente exacta.
5. Exportar tokens consumibles por CSS/TypeScript.

## Condiciones STOP
Valor visual sin fuente trazable; componente que duplica uno existente.

## Artefactos de salida
Componente/token documentado en el Design System; catalogo actualizado.

## Validaciones
Cero valores arbitrarios silenciosos; cero duplicados.

## Criterios de aceptacion
Cualquier otra skill/agente puede reutilizar el componente sin releer el prototipo original.

## Ejemplo minimo de invocacion
`design-system(component="data-table", ux_id="RES-01")`
