/** Type of incident stored in the database. */
export type IncidentType =
  | "damage"
  | "late_return"
  | "item_mismatch"
  | "not_delivered"
  | "other"
  | "not_available"
  | "forbidden_item";

/** Lifecycle state of an incident. */
export type IncidentStatus = "open" | "under_review" | "resolved" | "closed";

/** Priority level used for admin triage. */
export type IncidentPriority = "low" | "medium" | "high";

/** Full incident detail returned by the API. */
export interface IncidentResponse {
  incident_id: string;
  rental_id: string;
  reporter_id: string;
  reporter_name: string;
  reported_id: string;
  reported_name: string;
  booking_id: string;
  item_id: string;
  item_title: string;
  start_date: string;
  end_date: string;
  type: IncidentType;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  associated_cost: number;
  reported_at: string | null;
}

/** Paginated list of incidents. */
export interface IncidentListResponse {
  items: IncidentResponse[];
  total: number;
  page: number;
  limit: number;
}
