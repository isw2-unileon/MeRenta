-- Drop brand and model columns (no longer used) and add usage_rules.

ALTER TABLE item
    DROP COLUMN IF EXISTS brand,
    DROP COLUMN IF EXISTS model,
    ADD COLUMN usage_rules text;
