/** Referencia de auditoria visible en la tarjeta de conflicto (prototipo ALQ-09: `SYNC-ERR-*`). */
export function syncAuditRef(conflictId: string): string {
  return `SYNC-ERR-${conflictId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
