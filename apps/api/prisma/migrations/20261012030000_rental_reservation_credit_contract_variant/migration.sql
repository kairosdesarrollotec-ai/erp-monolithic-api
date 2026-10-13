-- AlterTable
ALTER TABLE "rental_contracts" ADD COLUMN     "contract_variant" VARCHAR(40);

-- AlterTable
ALTER TABLE "rental_deposits" ADD COLUMN     "reservation_credit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
