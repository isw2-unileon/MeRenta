CREATE TABLE IF NOT EXISTS public.conversation (
    conversation_id uuid                     NOT NULL DEFAULT gen_random_uuid(),
    customer_1_id   uuid                     NOT NULL,
    customer_2_id   uuid                     NOT NULL,
    item_id         uuid                     NOT NULL,
    created_at      timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT conversation_pkey PRIMARY KEY (conversation_id),
    CONSTRAINT conversation_customer_1_id_fkey FOREIGN KEY (customer_1_id)
        REFERENCES customer (customer_id),
    CONSTRAINT conversation_customer_2_id_fkey FOREIGN KEY (customer_2_id)
        REFERENCES customer (customer_id),
    CONSTRAINT conversation_item_id_fkey FOREIGN KEY (item_id)
        REFERENCES item (item_id) ON DELETE CASCADE,
    CONSTRAINT conversation_customer_1_id_customer_2_id_item_id_key UNIQUE (customer_1_id, customer_2_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.message (
    message_id      uuid                     NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid                     NOT NULL,
    sender_id       uuid                     NOT NULL,
    content         text                     NOT NULL,
    sent_at         timestamp with time zone NOT NULL DEFAULT now(),
    is_read         boolean                  NOT NULL DEFAULT false,
    CONSTRAINT message_pkey PRIMARY KEY (message_id),
    CONSTRAINT message_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES conversation (conversation_id) ON DELETE CASCADE,
    CONSTRAINT message_sender_id_fkey FOREIGN KEY (sender_id)
        REFERENCES customer (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_customer_1 ON conversation USING btree (customer_1_id);
CREATE INDEX IF NOT EXISTS idx_conversation_customer_2 ON conversation USING btree (customer_2_id);
CREATE INDEX IF NOT EXISTS idx_conversation_item ON conversation USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_message_conversation ON message USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_sent ON message USING btree (sent_at);
