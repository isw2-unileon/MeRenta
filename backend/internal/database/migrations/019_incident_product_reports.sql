ALTER TABLE incident
    ALTER COLUMN rental_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS item_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'incident_item_id_fkey'
    ) THEN
        ALTER TABLE incident
            ADD CONSTRAINT incident_item_id_fkey
            FOREIGN KEY (item_id) REFERENCES item (item_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'incident_subject_check'
    ) THEN
        ALTER TABLE incident
            ADD CONSTRAINT incident_subject_check
            CHECK (rental_id IS NOT NULL OR item_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_incident_item
    ON incident USING btree (item_id);
