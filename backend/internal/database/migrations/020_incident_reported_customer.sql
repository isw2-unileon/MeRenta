ALTER TABLE incident
    ADD COLUMN IF NOT EXISTS reported_customer_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'incident_reported_customer_id_fkey'
    ) THEN
        ALTER TABLE incident
            ADD CONSTRAINT incident_reported_customer_id_fkey
            FOREIGN KEY (reported_customer_id) REFERENCES customer (customer_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE incident DROP CONSTRAINT IF EXISTS incident_subject_check;
    ALTER TABLE incident
        ADD CONSTRAINT incident_subject_check
        CHECK (
            rental_id IS NOT NULL
            OR item_id IS NOT NULL
            OR reported_customer_id IS NOT NULL
        );
END $$;

CREATE INDEX IF NOT EXISTS idx_incident_reported_customer
    ON incident USING btree (reported_customer_id);
