CREATE TABLE IF NOT EXISTS feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT,
  blurb TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other news',
  status TEXT NOT NULL DEFAULT 'published',
  telegram_message_id TEXT,
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_items_status_published
ON feed_items (status, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_feed_items_category
ON feed_items (category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_published_source_url_unique
ON feed_items (lower(source_url))
WHERE status = 'published' AND source_url != '';

CREATE TABLE IF NOT EXISTS crawler_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER,
  user_agent TEXT NOT NULL DEFAULT '',
  bot_name TEXT,
  country TEXT,
  colo TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawler_access_logs_requested_at
ON crawler_access_logs (requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_access_logs_path
ON crawler_access_logs (path, requested_at DESC);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  source TEXT NOT NULL,
  cadence TEXT NOT NULL,
  status TEXT NOT NULL,
  market_count INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_fetched_at
ON market_snapshots (fetched_at DESC);

CREATE TABLE IF NOT EXISTS operational_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  workflow TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  http_status INTEGER,
  item_id TEXT,
  source_name TEXT,
  source_url TEXT,
  message TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  user_agent TEXT NOT NULL DEFAULT '',
  country TEXT,
  colo TEXT
);

CREATE INDEX IF NOT EXISTS idx_operational_events_occurred_at
ON operational_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_status
ON operational_events (status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_workflow
ON operational_events (workflow, occurred_at DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS site_content (
  content_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by TEXT
);
