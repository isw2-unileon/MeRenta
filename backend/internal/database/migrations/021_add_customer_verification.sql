-- Adds the profile verification badge workflow.
-- Admins grant this badge after visually checking existing profile data.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status_enum') THEN
        CREATE TYPE verification_status_enum AS ENUM ('none', 'pending', 'verified', 'rejected');
    END IF;
END $$;

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS verification_status verification_status_enum NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS requested_verification_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customer_verification_status
    ON customer (verification_status, requested_verification_at DESC);
