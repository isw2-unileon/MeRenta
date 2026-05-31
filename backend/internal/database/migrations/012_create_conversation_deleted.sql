CREATE TABLE IF NOT EXISTS public.conversation_deleted (
    conversation_id uuid                     NOT NULL,
    customer_id     uuid                     NOT NULL,
    deleted_at      timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT conversation_deleted_pkey PRIMARY KEY (conversation_id, customer_id),
    CONSTRAINT conversation_deleted_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES conversation (conversation_id) ON DELETE CASCADE,
    CONSTRAINT conversation_deleted_customer_id_fkey FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_deleted_customer
    ON conversation_deleted USING btree (customer_id);
