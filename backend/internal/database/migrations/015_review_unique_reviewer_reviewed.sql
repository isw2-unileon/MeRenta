DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'review'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%reviewer_id%'
          AND indexdef ILIKE '%reviewed_id%'
    ) THEN
        CREATE UNIQUE INDEX idx_review_reviewer_reviewed_unique
            ON public.review USING btree (reviewer_id, reviewed_id);
    END IF;
END $$;
