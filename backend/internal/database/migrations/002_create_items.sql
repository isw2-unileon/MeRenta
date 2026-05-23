-- NOTE: This migration requires the `address` table to exist first.
-- Run the address migration before applying this file.

CREATE TYPE category_enum AS ENUM (
    'tools',
    'electronics',
    'sports',
    'vehicles',
    'home',
    'clothing',
    'music',
    'garden',
    'leisure',
    'other'
);

CREATE TYPE item_status AS ENUM (
    'available',
    'rented',
    'maintenance',
    'retired'
);

CREATE TABLE item (
    item_id       uuid                     NOT NULL DEFAULT gen_random_uuid(),
    owner_id      uuid                     NOT NULL,
    address_id    uuid                     NOT NULL,
    category      category_enum            NOT NULL,
    title         varchar(200)             NOT NULL,
    description   text,
    brand         varchar(100),
    model         varchar(100),
    item_status   item_status              NOT NULL DEFAULT 'available',
    price_per_day numeric(10, 2)           NOT NULL,
    deposit       numeric(10, 2),
    is_available  boolean                  NOT NULL DEFAULT true,
    published_at  timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT item_pkey              PRIMARY KEY (item_id),
    CONSTRAINT item_address_id_fkey   FOREIGN KEY (address_id) REFERENCES address (address_id),
    CONSTRAINT item_owner_id_fkey     FOREIGN KEY (owner_id)   REFERENCES customer (customer_id) ON DELETE CASCADE,
    CONSTRAINT item_deposit_check       CHECK (deposit >= 0),
    CONSTRAINT item_price_per_day_check CHECK (price_per_day > 0)
);

CREATE INDEX IF NOT EXISTS idx_item_owner     ON item USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_item_category  ON item USING btree (category);
CREATE INDEX IF NOT EXISTS idx_item_available ON item USING btree (is_available);
CREATE INDEX IF NOT EXISTS idx_item_address   ON item USING btree (address_id);
