CREATE TABLE IF NOT EXISTS classrooms (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  open_mask INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS classrooms_newest ON classrooms(created_at DESC);
CREATE TABLE IF NOT EXISTS classroom_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS classroom_sessions_expiry ON classroom_sessions(expires_at);
CREATE TABLE IF NOT EXISTS classroom_login_attempts (
  address TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
