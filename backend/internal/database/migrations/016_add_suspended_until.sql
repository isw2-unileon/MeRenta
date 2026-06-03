-- Adds support for timed suspensions.
-- The suspended_until column stores when the suspension expires (NULL = indefinite).

ALTER TABLE customer ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
