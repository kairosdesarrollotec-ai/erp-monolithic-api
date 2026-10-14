-- AlterTable
ALTER TABLE "rental_deposits" ADD COLUMN     "reservation_credit_excess" DECIMAL(12,2) NOT NULL DEFAULT 0;
