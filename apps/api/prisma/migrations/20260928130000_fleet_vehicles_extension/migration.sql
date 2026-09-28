-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "branch_id" TEXT,
ADD COLUMN "year" INTEGER,
ADD COLUMN "color" TEXT,
ADD COLUMN "category" TEXT DEFAULT 'SEDAN',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "daily_rate" DECIMAL(10,2),
ADD COLUMN "photo_url" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "vehicles_operating_company_id_status_idx" ON "vehicles"("operating_company_id", "status");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_operating_company_id_fkey" FOREIGN KEY ("branch_id", "operating_company_id") REFERENCES "branches"("id", "company_id") ON DELETE SET NULL ON UPDATE CASCADE;
