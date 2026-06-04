ALTER TABLE booking
    ADD COLUMN IF NOT EXISTS item_title_snapshot text,
    ADD COLUMN IF NOT EXISTS item_image_url_snapshot text,
    ADD COLUMN IF NOT EXISTS owner_id_snapshot uuid;

UPDATE booking b
SET
    item_title_snapshot = COALESCE(b.item_title_snapshot, i.title),
    item_image_url_snapshot = COALESCE(b.item_image_url_snapshot, img.image_url),
    owner_id_snapshot = COALESCE(b.owner_id_snapshot, i.owner_id)
FROM item i
LEFT JOIN LATERAL (
    SELECT image_url
    FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order, image_id
    LIMIT 1
) img ON true
WHERE b.item_id = i.item_id;

ALTER TABLE booking
    ALTER COLUMN item_id DROP NOT NULL;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE rel.relname = 'booking'
          AND ref.relname = 'item'
          AND att.attname = 'item_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE booking DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE booking
    ADD CONSTRAINT booking_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_owner_snapshot ON booking (owner_id_snapshot);

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE rel.relname = 'item_image'
          AND ref.relname = 'item'
          AND att.attname = 'item_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE item_image DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE item_image
    ADD CONSTRAINT item_image_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE CASCADE;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE rel.relname = 'favorite'
          AND ref.relname = 'item'
          AND att.attname = 'item_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE favorite DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE favorite
    ADD CONSTRAINT favorite_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE CASCADE;

ALTER TABLE conversation
    ALTER COLUMN item_id DROP NOT NULL;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE rel.relname = 'conversation'
          AND ref.relname = 'item'
          AND att.attname = 'item_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE conversation DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE conversation
    ADD CONSTRAINT conversation_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE SET NULL;

ALTER TABLE incident
    ADD COLUMN IF NOT EXISTS item_title_snapshot text,
    ADD COLUMN IF NOT EXISTS item_owner_id_snapshot uuid;

UPDATE incident i
SET
    item_title_snapshot = COALESCE(i.item_title_snapshot, it.title),
    item_owner_id_snapshot = COALESCE(i.item_owner_id_snapshot, it.owner_id)
FROM item it
WHERE i.item_id = it.item_id;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE rel.relname = 'incident'
          AND ref.relname = 'item'
          AND att.attname = 'item_id'
          AND con.contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE incident DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE incident
    ADD CONSTRAINT incident_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item(item_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incident_item_owner_snapshot ON incident (item_owner_id_snapshot);
