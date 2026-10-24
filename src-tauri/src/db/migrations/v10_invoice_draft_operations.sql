-- Durable identity survives invoice deletion. No cascading foreign key is intentional.
CREATE TABLE draft_create_operations (
    idempotency_key TEXT PRIMARY KEY NOT NULL CHECK (idempotency_key LIKE 'draft-create:%'),
    request_fingerprint TEXT NOT NULL,
    request_json TEXT NOT NULL,
    invoice_id TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER,
    deleted_version INTEGER,
    CHECK ((deleted_at IS NULL AND deleted_version IS NULL) OR
           (deleted_at IS NOT NULL AND deleted_version >= 1))
);
