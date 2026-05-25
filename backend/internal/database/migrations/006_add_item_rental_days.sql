ALTER TABLE item
    ADD COLUMN IF NOT EXISTS min_days integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_days integer;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'item'
          AND column_name = 'max_day'
    ) THEN
        UPDATE item
        SET max_days = COALESCE(max_days, max_day)
        WHERE max_days IS NULL;

        ALTER TABLE item DROP CONSTRAINT IF EXISTS item_max_day_check;
        ALTER TABLE item DROP COLUMN max_day;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_min_days_check'
    ) THEN
        ALTER TABLE item
            ADD CONSTRAINT item_min_days_check CHECK (min_days >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_max_days_check'
    ) THEN
        ALTER TABLE item
            ADD CONSTRAINT item_max_days_check CHECK (max_days IS NULL OR max_days >= min_days);
    END IF;
END $$;
