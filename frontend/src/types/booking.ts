/** Possible lifecycle states of a booking. */
export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

/** Booking with joined item and renter data, used in list views. */
export interface BookingDetailResponse {
  booking_id: string;
  item_id: string;
  item_title: string;
  item_image_url: string;
  renter_id: string;
  renter_first_name: string;
  renter_last_name: string;
  renter_verification_status: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  requested_at: string;
  booking_status: BookingStatus;
  estimated_total: number | null;
  notes: string;
  payment_intent_id: string;
  expires_at: string;
}

/** Paginated list of bookings. */
export interface BookingListResponse {
  items: BookingDetailResponse[];
  total: number;
}
