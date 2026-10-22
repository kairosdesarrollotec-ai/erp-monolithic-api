# Consolidado de avance por flujo — 2026-10-22

Base: auditorías del 21-oct (`Auditoria_{CON,RES,ALQ,DEV,TR,REC,ADP}_2026-10-21`, en el Project "Kairos Project") + lo reportado por los agentes del 22-oct. **Lo del 22-oct NO está verificado** (faltan `prisma generate`, migraciones, tests y tsc en el Mac): los % del 22-oct son estimaciones.

Ponderado: conforme = 1, parcial = 0,5, falta = 0, fuera de alcance excluido. Estricto: solo lo conforme.

| Flujo | Ítems | 21-oct ponderado | 22-oct ponderado (est.) | 22-oct estricto (est.) | Camino feliz |
|---|---:|---:|---:|---:|---|
| Consulta (CON) | 66 | 58 % | ~74 % | ~59 % | ~90 % |
| Reserva (RES) | 86 | 63 % | ~67 % | ~52 % | ~88 % |
| Alquiler (ALQ) | ~60 | ~55 % | ~62 % | ~45 % | ~80 % |
| Devolución (DEV) | 87 | 86 % | ~89 % | ~75 % | ~97 % |
| Reclutamiento (REC) | 86 | 79 % | ~85 % | ~74 % | ~97 % |
| Administración de Personal (ADP) | 69 | 84 % | ~94 % | ~90 % | ~95 % |
| Transversal / soporte (TR) | ~40 | ~78 % | ~80 % | ~70 % | ~90 % |
| **Total** | **~494** | **~72 %** | **~79 %** | **~67 %** | |

## Lo que falta en ESTE repo (back: `erp-api-local`)

### Consulta
- Rutas y trocha (BR-CON-005, SC-CON-004): catálogo y revisión manual (necesita Q-02).
- Evidencia de modalidad virtual (DAT-CON-006) y estados "En atención/En seguimiento" (si negocio lo confirma).
- Validar `Vehicle.status` al cotizar, `CUSTOMER_BLOCKED` en convertir a reserva, filtros por nombre/documento y paginación.

### Reserva
- Modalidad remota: `ReservationAcceptance`, tipos VIDEO_360/ACCEPTANCE_DOC y `ACCEPTANCE_INCOMPLETE`.
- Validar pago (`INVALID_DEPOSIT_AMOUNT`) sin aceptar monto/versión del cliente; `register-documents` exigiendo documentos.
- Prevención de venta de vehículo reservado (`VEHICLE_HAS_ACTIVE_COMMITMENT`); persistir `canComeToOffice`/ubicación (DAT-RES-001).
- Contrato de reserva desde plantilla (S/300) y formato WhatsApp N°03; 409 en `VEHICLE_NOT_AVAILABLE`, `INVALID_PERIOD`, `missingRequirements`.
- Conductor en reserva, aeropuerto, notificaciones; pruebas de integración de punta a punta.

### Alquiler
- Documentos por nacionalidad y EX-ALQ-001; gasto notarial como costo de la empresa; persistir evaluación notarial.
- Doble garantía x2 y validación contra tarifa de Flota; persistir tiempos y excepción; bloqueo por SOAT/documentos del vehículo.
- Efectos de falta grave, aprobador de respaldo 5 min, solicitud de ampliación (motivo, horas/días).
- Planes y km, archivo físico + Drive, lectura de política y huella; GPS (bloqueado por negocio).

### Devolución
- Respuesta del cliente al informe Motrix; cargo por retraso dentro de `close-financial`; multa de combustible.
- Doble aprobación y retención de evidencia (1+5 años); persistir FIV/FCKE; vía legal; notificación formal.
- Rol de clasificación de gravedad, verificación de identidad, `CANCELADA`, auditoría por daño oculto, visibilidad de grupo del semáforo.

### Reclutamiento
- HU-33 alerta de vencimiento, HU-32/34 inducción, integración REC→ADP (alta y paso a planilla), ficha de expectativas, disponibilidad.
- Prohibir portales generales para mecánico, validar fecha de ingreso, modalidad de pago derivada, `Idempotency-Key` en decide/onboarding/evaluate, antivirus/purga de CV.

### Administración de Personal
- HU-31 repositorio de documentos de TH; sanciones acumuladas (máx. 3 → suspensión → cese) y tabla de sanciones.
- Niveles de cascada ligados a Fiorella → José → Cecilia; autoservicio de vacaciones/permisos; contratos y cuentas bancarias (HU-35).
- Permiso propio del supervisor de sincronización.

### Transversal
- Revocación de sesión en servidor, schedulers a Cloud Tasks, bloqueo de login, logs/trazas/backups.
- Bucket GCS, seed `hr_areas` y plantilla de contrato con archivo, Firebase/CI en pruebas, F-06/S-03.
- Verificar ítems NV: GPS en Flota, duplicados de clientes, canales externos de notificación, RLS, rate limits, hora Lima.

## Condiciones para que el % sea real
1. `npx prisma generate` y aplicar las 14 migraciones (20261021010001–020001 y 20261022010001–040001).
2. Suite back (unit + integración `--runInBand`) y front (`npx tsc -b --noEmit` + tests).
3. Cerrar el seguimiento de front de Consulta/Reserva/Devolución (G5) y la persistencia de `canComeToOffice` en el back.
4. Decisiones de negocio abiertas: niveles de cascada por persona, tabla de sanciones, tercera vía notarial, tope de vacaciones, cargo por retraso en la liquidación, multa de combustible, vía legal, rutas de trocha.

