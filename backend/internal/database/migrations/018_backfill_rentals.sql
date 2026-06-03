-- Backfill rental records for bookings that were accepted before the rental
-- creation was wired into the accept flow.
-- ON CONFLICT is safe: if a rental already exists for a booking, it is skipped.

INSERT INTO rental (booking_id)
SELECT booking_id
FROM   booking
WHERE  booking_status IN ('accepted', 'completed')
ON CONFLICT (booking_id) DO NOTHING;
