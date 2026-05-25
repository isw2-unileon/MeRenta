DO $$
BEGIN
    CREATE TYPE item_condition AS ENUM (
        'new',
        'like_new',
        'good',
        'fair',
        'poor'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE item
    ADD COLUMN IF NOT EXISTS item_condition item_condition NOT NULL DEFAULT 'good';
