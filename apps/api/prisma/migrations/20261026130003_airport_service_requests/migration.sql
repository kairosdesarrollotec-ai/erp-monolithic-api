-- C1: Solicitud de servicio de aeropuerto como cargo adicional (EX-RES-003, BDD-ALQ 7.1.1)
CREATE TYPE "AirportServiceTargetType" AS ENUM ('RESERVATION', 'RENTAL');

CREATE TABLE "airport_service_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "target_type" "AirportServiceTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "additional_amount" DECIMAL(12, 2) NOT NULL,
    "notes" TEXT,
    "registered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airport_service_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_airport_service_target" ON "airport_service_requests"("target_type", "target_id");
CREATE INDEX "idx_airport_service_scope" ON "airport_service_requests"("organization_id", "operating_company_id", "branch_id", "scheduled_at");
