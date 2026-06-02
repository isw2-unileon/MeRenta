-- Add Stripe payment tracking and 5-day expiry to bookings.
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_booking_expires
    ON public.booking USING btree (expires_at)
    WHERE booking_status = 'pending';
