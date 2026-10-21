-- Respuestas 2026-10-20 #34: purga de avisos del tablero ya VISTOS (dismissed_at no nulo). Indice para el barrido por antiguedad.
CREATE INDEX "dashboard_items_dismissed_at_idx" ON "dashboard_items"("dismissed_at");
