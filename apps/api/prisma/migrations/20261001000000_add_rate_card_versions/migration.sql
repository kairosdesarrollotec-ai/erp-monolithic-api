-- Tarifario versionado por empresa.
-- Reemplaza ProvisionalRateCardAdapter (PROP-007).
-- currentFor: fila más reciente donde effective_from <= now() para la empresa dada.
-- Rollback: DROP TABLE rate_card_versions;

-- CreateTable
CREATE TABLE "rate_card_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "amount_per_day" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "validity_hours" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "rate_card_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_card_versions_company_effective_idx"
    ON "rate_card_versions"("operating_company_id", "effective_from");
