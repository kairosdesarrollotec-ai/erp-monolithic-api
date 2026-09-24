/**
 * BDD-CON-001.md DAT-CON-004 - canal de contacto (enum informal
 * "WhatsApp/llamada/presencial/web/redes"). Distinto de `ChannelMode`
 * (modalidad PRESENCIAL/VIRTUAL de Reserva) - aqui `channel` es el canal
 * por el que el cliente contacto, no la modalidad de exhibicion del
 * vehiculo (esa es DAT-CON-006/CON-03, fuera del modelo de Inquiry, se
 * resuelve en el momento de mostrar el vehiculo, no se persiste aqui).
 */
export type InquiryChannel = 'WHATSAPP' | 'LLAMADA' | 'PRESENCIAL' | 'WEB' | 'REDES';
