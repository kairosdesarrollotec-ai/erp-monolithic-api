/**
 * TDD-CON-001.md seccion 8 (11.4 del BDD referencia una maquina de 6
 * estados mas granular - "En atencion"/"En seguimiento" - pero el modelo
 * fisico de la seccion 9 del TDD, que es el contrato vinculante de este
 * corte, solo persiste estos 4: REGISTRADA es el estado inicial, COTIZADA
 * se alcanza con el comando `quote`, y CONVERTIDA/CERRADA_SIN_CONVERSION
 * son terminales). No se expone `PATCH status`: cada transicion es un
 * metodo propio del agregado invocado por un handler dedicado.
 */
export type InquiryStatus = 'REGISTRADA' | 'COTIZADA' | 'CONVERTIDA' | 'CERRADA_SIN_CONVERSION';
