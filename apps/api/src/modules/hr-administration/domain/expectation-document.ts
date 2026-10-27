/**
 * REC-P13 / BDD-05 / BDD-00 - Reglas de dominio del Documento de Expectativas del colaborador.
 * Plazo legal/operativo: hireDate + 2 días (a los 2 días de ingreso).
 */

export function computeExpectationDeadlineDate(hireDate: Date): Date {
  const deadline = new Date(hireDate.getTime());
  deadline.setUTCDate(deadline.getUTCDate() + 2);
  return deadline;
}

export function isExpectationOverdue(
  status: string,
  deadlineDate: Date,
  now: Date = new Date(),
): boolean {
  if (status === 'FIRMADO') return false;
  // Final del día límite en UTC
  const deadlineEnd = new Date(deadlineDate.getTime());
  deadlineEnd.setUTCHours(23, 59, 59, 999);
  return now.getTime() > deadlineEnd.getTime();
}
