/**
 * TDD-ALQ-001.md seccion 9.3 / BR-DOC-002 - unico tipo de plantilla de
 * contrato que existe hoy (contrato de alquiler). El campo `type` de
 * ContractTemplate queda abierto (varchar(30)) para cuando el negocio
 * defina otros tipos de documento (p.ej. addendums), pero el flujo de
 * formalize-contract solo resuelve este tipo automaticamente.
 */
export const RENTAL_CONTRACT_TEMPLATE_TYPE = 'RENTAL_CONTRACT';
