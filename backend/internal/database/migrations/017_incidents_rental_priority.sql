-- rental table already exists in Supabase with its full schema:
--   rental_id, booking_id UNIQUE FK, rental_status (enum, default 'ongoing'),
--   actual_start_date, actual_end_date, actual_return_date,
--   final_amount, late_return_fee (default 0).
-- No DDL for rental needed.

-- Add priority to incident for admin triage (safe if column already present).
ALTER TABLE incident
    ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
