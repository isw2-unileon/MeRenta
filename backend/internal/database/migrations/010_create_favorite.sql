CREATE TABLE public.favorite (
    customer_id uuid        NOT NULL,
    item_id     uuid        NOT NULL,
    saved_at    timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT favorite_pkey             PRIMARY KEY (customer_id, item_id),
    CONSTRAINT favorite_customer_id_fkey FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id) ON DELETE CASCADE,
    CONSTRAINT favorite_item_id_fkey     FOREIGN KEY (item_id)
        REFERENCES item (item_id) ON DELETE CASCADE
) TABLESPACE pg_default;
