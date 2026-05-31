CREATE TABLE IF NOT EXISTS public.review (
    review_id   uuid                     NOT NULL DEFAULT gen_random_uuid(),
    reviewer_id uuid                     NOT NULL,
    reviewed_id uuid                     NOT NULL,
    rating      integer                  NOT NULL,
    comment     text                     NOT NULL DEFAULT '',
    reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT review_pkey PRIMARY KEY (review_id),
    CONSTRAINT review_reviewer_id_fkey FOREIGN KEY (reviewer_id)
        REFERENCES customer (customer_id),
    CONSTRAINT review_reviewed_id_fkey FOREIGN KEY (reviewed_id)
        REFERENCES customer (customer_id),
    CONSTRAINT review_rating_check CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT review_reviewer_reviewed_check CHECK (reviewer_id <> reviewed_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reviewed ON review USING btree (reviewed_id);
CREATE INDEX IF NOT EXISTS idx_review_reviewer ON review USING btree (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_reviewed_at ON review USING btree (reviewed_at);
