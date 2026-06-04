interface AuditEntry {
  log_id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value: string;
  detail?: string;
  created_at: string;
}

interface AuditLogListResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

export type { AuditEntry, AuditLogListResponse };
