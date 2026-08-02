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
