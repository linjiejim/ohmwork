-- Ohmwork cloud-sync schema (Cloudflare D1 / SQLite)
-- Local:  cd worker && npx wrangler d1 migrations apply ohmwork --local
-- Remote: cd worker && npx wrangler d1 migrations apply ohmwork --remote

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  username_lower TEXT UNIQUE,
  password_hash TEXT,
  github_id TEXT UNIQUE,
  github_login TEXT,
  github_name TEXT,
  github_avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, lesson_key)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('login', 'link')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  return_to TEXT NOT NULL,
  origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_tickets (
  code TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  event TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- A GitHub account waiting to be bound. The OAuth callback only writes this row; the account that
-- started the binding confirms it with its own session (POST /account/github/link-confirm).
CREATE TABLE IF NOT EXISTS github_link_tickets (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_avatar_url TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
