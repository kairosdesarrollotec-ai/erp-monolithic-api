-- Migration: 20261011000002_rental_deposits_close_fields
-- Adds closure tracking fields to rental_deposits (PAG-01/PAG-02, TDD-PAG-001).
-- Forward-only. Reversible: DROP COLUMN IF EXISTS.
-- Safe for existing data: both columns are nullable.

ALTER TABLE rental_deposits ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE rental_deposits ADD COLUMN IF NOT EXISTS closure_notes VARCHAR(500);
