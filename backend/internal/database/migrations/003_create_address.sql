-- Stores the home / pick-up addresses of customers.
-- One customer may own many addresses; the item table references one of them
-- as the pickup location for that listing.

CREATE TABLE address (
    address_id  uuid                     NOT NULL DEFAULT gen_random_uuid(),
    customer_id uuid                     NOT NULL,
    street      character varying(255)   NOT NULL,
    number      character varying(10)    NOT NULL,
    floor       character varying(20),
    city        character varying(100)   NOT NULL,
    province    character varying(100)   NOT NULL,
    postal_code character varying(10)    NOT NULL,
    country     character varying(100)   NOT NULL DEFAULT 'Spain',
    latitude    numeric(10, 7),
    longitude   numeric(10, 7),
    CONSTRAINT address_pkey            PRIMARY KEY (address_id),
    CONSTRAINT address_customer_id_fkey FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_address_customer ON address USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_address_coords   ON address USING btree (latitude, longitude);

-- Re-add the FK constraint on item now that address exists.
ALTER TABLE item
    ADD CONSTRAINT item_address_id_fkey
        FOREIGN KEY (address_id) REFERENCES address (address_id);
