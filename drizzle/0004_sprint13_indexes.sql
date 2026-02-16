-- Sprint 13: Additional performance indexes
-- users.email already has a UNIQUE constraint (implicit index), but an explicit
-- index improves clarity and cross-DB portability (PostgreSQL migration).
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
