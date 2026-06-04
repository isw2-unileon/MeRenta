CREATE TABLE IF NOT EXISTS admin_audit_log (
    log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID        REFERENCES customer(customer_id) ON DELETE SET NULL,
    admin_email TEXT        NOT NULL,
    action      TEXT        NOT NULL,
    entity_type TEXT        NOT NULL,
    entity_id   TEXT        NOT NULL,
    old_value   TEXT,
    new_value   TEXT        NOT NULL,
    detail      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin   ON admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action  ON admin_audit_log (action);
